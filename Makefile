# Work around current start-cli Docker invocation ordering on newer Docker CLIs.
export PATH := $(CURDIR)/.startos-bin:$(PATH)

# overrides to s9pk.mk must precede the include statement
# Upstream ghcr.io/tailscale/tailscale does not publish a riscv64 image, so
# we can't build that arch without compiling Tailscale from source. Drop it.
ARCHES := x86 arm

include s9pk.mk
