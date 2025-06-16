{ pkgs, ... }:
pkgs.buildNpmPackage {
  pname = "storage-cli";
  version = "0.1.0";

  src = ./.;

  # Obtained with `prefetch-npm-deps package-lock.json`
  npmDepsHash = "sha256-T6UuVlGs2DUvgKZnizcHTGYqdy16fGA/zR4cHG2UQ5Q=";
}
