package server

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/Rhizomatica/hermes-backend/internal/config"
)

// Server is the hermesd HTTP entrypoint. It will host the REST /api/v2 surface
// and the hermes.v1 WebSocket upgrade route on the same port.
type Server struct {
	cfg    config.Config
	logger *slog.Logger
	mux    *http.ServeMux
}

// New builds a Server and registers its routes.
func New(cfg config.Config, logger *slog.Logger) *Server {
	s := &Server{
		cfg:    cfg,
		logger: logger,
		mux:    http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /health", s.handleHealth)
}

// ServeHTTP satisfies http.Handler.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"version": "0.1.0",
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
