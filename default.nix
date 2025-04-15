{ pkgs, ... }:
pkgs.buildNpmPackage {
  pname = "storage-cli";
  version = "0.1.0";

  src = ./.;

  # Obtained with `prefetch-npm-deps package-lock.json`
  npmDepsHash = "sha256-mSIPtmyL46rYQoc50jArNbYp43EZAzfJVkeHQgD+hNc=";
}
