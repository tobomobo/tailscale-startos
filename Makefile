# Work around current start-cli Docker invocation ordering on newer Docker CLIs.
export PATH := $(CURDIR)/.startos-bin:$(PATH)

# overrides to s9pk.mk must precede the include statement
include s9pk.mk
