BINARY := hermesd

.PHONY: build run test vet fmt tidy clean

build:
	go build -o bin/$(BINARY) ./cmd/hermesd

run:
	go run ./cmd/hermesd

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

tidy:
	go mod tidy

clean:
	rm -rf bin
