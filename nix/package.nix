{
  brotli,
  buildNpmPackage,
  fd,
  google-fonts,
  importNpmLock,
  lib,
  zopfli,
}:

let
  packageJson = lib.importJSON ../package.json;
  pname = packageJson.name;
  version = packageJson.version;
  fonts = google-fonts.override {
    fonts = [
      "Geist"
      "GeistMono"
    ];
  };
in
buildNpmPackage {
  inherit pname version;

  src = ./..;

  npmDeps = importNpmLock { npmRoot = ./..; };
  npmConfigHook = importNpmLock.npmConfigHook;

  preBuild = ''
    cp "${fonts}/share/fonts/truetype/Geist[wght].ttf" \
      "${fonts}/share/fonts/truetype/GeistMono[wght].ttf" \
      app/
  '';

  nativeBuildInputs = [
    brotli
    fd
    zopfli
  ];

  env.NEXT_TELEMETRY_DISABLED = "1";

  postBuild = ''
    fd \
      --type f \
      --extension css \
      --extension html \
      --extension js \
      --extension svg \
      --extension ttf \
      --search-path .next/static \
      --search-path public \
      --threads "$NIX_BUILD_CORES" \
      --exec sh -c 'zopfli --i100 --gzip {}; brotli --best --keep {}'
  '';

  postInstall = ''
    ln -s "$out/lib/node_modules/${pname}/public" "$out/lib/node_modules/${pname}/.next/standalone/public"
    ln -s "$out/lib/node_modules/${pname}/.next/static" "$out/lib/node_modules/${pname}/.next/standalone/.next/static"
    rm -rf "$out/lib/node_modules/${pname}/node_modules"
  '';

  meta = {
    changelog = "https://github.com/bulwarkmail/webmail/releases/tag/${version}";
    description = "A modern, self-hosted webmail client for Stalwart Mail Server";
    downloadPage = "https://github.com/bulwarkmail/webmail/releases";
    license = lib.licenses.agpl3Only;
    homepage = "https://bulwarkmail.org/";
    mainProgram = "bulwark-webmail-server";
    maintainers = [ lib.maintainers.oynqr ];
  };
}
