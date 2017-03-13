bootstrap:		## Run database bootstrap
	@docker-compose -f docker-compose-bootstrap.yml up db bootstrap

.PHONY: bootstrap
