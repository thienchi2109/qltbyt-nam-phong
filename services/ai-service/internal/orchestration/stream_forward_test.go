package orchestration

import (
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/cloudwego/eino/schema"
)

func TestForwardStreamDeliversErrorToOpenReader(t *testing.T) {
	sourceReader, sourceWriter := schema.Pipe[*schema.Message](1)
	outReader, outWriter := schema.Pipe[*schema.Message](1)
	go func() {
		_ = sourceWriter.Send(nil, errors.New("stream broke sk-secret"))
		sourceWriter.Close()
	}()
	forwardStream(sourceReader, outWriter, &meterState{})
	_, err := outReader.Recv()
	if err == nil || !strings.Contains(err.Error(), "stream broke") {
		t.Fatalf("open reader lost the error: %v", err)
	}
	if _, err := outReader.Recv(); !errors.Is(err, io.EOF) {
		t.Fatalf("writer close after error = %v", err)
	}
}

func TestForwardStreamDropsErrorWhenReaderIsClosed(t *testing.T) {
	sourceReader, sourceWriter := schema.Pipe[*schema.Message](1)
	outReader, outWriter := schema.Pipe[*schema.Message](1)
	outReader.Close()
	go func() {
		_ = sourceWriter.Send(nil, errors.New("sk-secret dropped"))
		sourceWriter.Close()
	}()
	forwardStream(sourceReader, outWriter, &meterState{})
	if _, err := outReader.Recv(); !errors.Is(err, io.EOF) {
		t.Fatalf("closed reader should see writer close as EOF, got %v", err)
	}
}
