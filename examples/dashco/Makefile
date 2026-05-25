.PHONY: install test typecheck demo day-one server clean

install:
	bun install

test:
	bun test

typecheck:
	bun run typecheck

demo:
	bun run demo

day-one: install
	@echo "==> running tests with AI_ENABLED=false (proves AI is not load-bearing)"
	bun test
	@echo
	@echo "==> running typecheck"
	bun run typecheck
	@echo
	@echo "==> running end-to-end day-one (real PGLite + Hono, no mocks)"
	bun run day-one

server: install
	bun run server

clean:
	rm -rf node_modules data/
