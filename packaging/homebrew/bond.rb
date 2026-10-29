# Generado por scripts/packaging.mts desde la release v1.9.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.9.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.9.0/bond-darwin-arm64"
      sha256 "def0cdd7f7bcbe24c4392c8fa90fb89719503a02a4c89f56f6a6bd17c9295ad3"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.9.0/bond-darwin-x64"
      sha256 "8e2fcc8c9c312aaa48fe6f2cd653851fb15a0c57b95b382ec926d962b580e838"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.9.0/bond-linux-arm64"
      sha256 "0ba1dd81c6f444806284cbba41ab973fb9a781e87dad35e4b180725813a88f6d"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.9.0/bond-linux-x64"
      sha256 "f47ed307755ab35a92dbb282de6dcc3b049696abf5a25d524aae431558541a33"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
