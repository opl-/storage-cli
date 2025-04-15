{
  description = "Storage directory management tool.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      # Support all systems supported by nodejs
      allSystems = [
        "aarch64-linux"
        "x86_64-linux"
        "x86_64-darwin"
        "aarch64-linux"
        "aarch64-darwin"
        "i686-linux"
      ];

      # Helper to provide system-specific attributes
      forAllSystems = f: nixpkgs.lib.genAttrs allSystems (system: f {
        inherit system;
        pkgs = import nixpkgs { inherit system; };
      });
    in
    {
      packages = forAllSystems ({ pkgs, ... }: rec {
        default = storage-cli;
        storage-cli = pkgs.callPackage ./default.nix {};
      });

      overlays = {
        default = final: prev: {
          storage-cli = self.packages.${prev.system}.storage-cli;
        };
      };
    };
}
