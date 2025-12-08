-include .env

SENDER = $(shell cast wallet address --private-key $(PRIVATE_KEY))

deploy:
	@echo ">> Deploying (no verify)"
	forge script script/Deploy.s.sol \
		--rpc-url $(SCROLL_RPC) \
		--broadcast \
		--sender $(SENDER)

deploy_and_verify:
	@if [ -z "$(NETWORK_EXPLORER_API_KEY)" ]; then \
		echo "ERROR: NETWORK_EXPLORER_API_KEY not set"; \
		exit 1; \
	fi
	@echo ">> Deploying + Verifying contracts"
	forge script script/Deploy.s.sol \
		--rpc-url $(SCROLL_RPC) \
		--broadcast \
		--verify \
		--verifier etherscan \
		--etherscan-api-key $(NETWORK_EXPLORER_API_KEY) \
		--sender $(SENDER)

.PHONY: deploy deploy_and_verify
