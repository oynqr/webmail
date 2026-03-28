{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.bulwark-webmail;
in
{
  options.services.bulwark-webmail = {
    enable = lib.mkEnableOption "a modern, self-hosted webmail client for Stalwart Mail Server";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix { };
    };

    environment = lib.mkOption {
      type = lib.types.submodule {
        freeformType = lib.types.attrsOf lib.types.str;
        options = {
          APP_NAME = lib.mkOption {
            type = lib.types.str;
            default = "Bulwark Webmail";
          };
          BULWARK_TELEMETRY = lib.mkOption {
            type = lib.types.str;
            default = "off";
          };
          JMAP_SERVER_URL = lib.mkOption {
            type = lib.types.str;
            default = "https://your-jmap-server.com";
          };
          HOSTNAME = lib.mkOption {
            type = lib.types.str;
            default = "0.0.0.0";
          };
          LOGIN_LOGO_LIGHT_URL = lib.mkOption {
            type = lib.types.str;
            default = "/branding/Bulwark_Logo_Color.svg";
          };
          LOGIN_LOGO_DARK_URL = lib.mkOption {
            type = lib.types.str;
            default = "/branding/Bulwark_Logo_Color.svg";
          };
          LOGIN_COMPANY_NAME = lib.mkOption {
            type = lib.types.str;
            default = "Bulwark Webmail";
          };
          LOGIN_WEBSITE_URL = lib.mkOption {
            type = lib.types.str;
            default = "https://bulwarkmail.org";
          };
          NEXT_TELEMETRY_DISABLED = lib.mkOption {
            type = lib.types.str;
            default = "1";
          };
          NODE_ENV = lib.mkOption {
            type = lib.types.str;
            default = "production";
          };
        };
      };
      default = { };
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
    };

    reverseProxy = lib.mkOption {
      type = lib.types.submodule {
        options = {
          enable = lib.mkEnableOption "an nginx reverse proxy configuration for bulwark-webmail";
          hostname = lib.mkOption {
            type = lib.types.str;
            default = "localhost";
          };
        };
      };
    };
  };
  config = lib.mkIf cfg.enable {
    services.nginx.virtualHosts.${cfg.reverseProxy.hostname} = lib.mkIf cfg.reverseProxy.enable {
      locations = {
        "/" = {
          proxyPass = lib.mkDefault "http://${cfg.environment.HOSTNAME}:${toString cfg.environment.PORT}";
          recommendedProxySettings = lib.mkDefault true;
        };
        "/_next/static/".alias =
          lib.mkDefault "${cfg.package}/lib/node_modules/bulwark-webmail/.next/static/";
      };
    };
    systemd.services.bulwark-webmail = {
      description = "Bulwark Webmail for Stalwart";
      wantedBy = [ "multi-user.target" ];
      after = [
        "local-fs.target"
        "network.target"
      ];
      inherit (cfg) environment;
      serviceConfig = {
        Type = "simple";

        ExecStart = [
          ""
          "${lib.getExe cfg.package}"
        ];

        DynamicUser = true;
        StateDirectory = "bulwark-webmail";

        DeviceAllow = [ "" ];
        LockPersonality = true;
        PrivateDevices = true;
        PrivateUsers = true;
        ProcSubset = "pid";
        PrivateTmp = true;
        ProtectClock = true;
        ProtectControlGroups = true;
        ProtectHome = true;
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelModules = true;
        ProtectKernelTunables = true;
        ProtectProc = "invisible";
        ProtectSystem = "strict";
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
        ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        SystemCallArchitectures = "native";
        SystemCallFilter = [
          "@system-service"
          "~@privileged"
        ];
        UMask = "0077";

        EnvironmentFile = cfg.environmentFile;
      };
    };
  };
}
