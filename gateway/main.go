package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"
)

type route struct {
	ID            string `json:"id"`
	PackageID     string `json:"packageId"`
	PackageTitle  string `json:"packageTitle"`
	InterfaceID   string `json:"interfaceId"`
	InterfaceName string `json:"interfaceName"`
	InterfaceType string `json:"interfaceType"`
	Mode          string `json:"mode"`
	ExternalPort  int    `json:"externalPort"`
	LocalPort     int    `json:"localPort"`
	TargetHost    string `json:"targetHost"`
	TargetPort    int    `json:"targetPort"`
	TargetScheme  string `json:"targetScheme"`
}

type config struct {
	Version int     `json:"version"`
	Routes  []route `json:"routes"`
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("[tailscale-gateway] ")

	if len(os.Args) < 2 {
		fatalf("expected subcommand: proxy or apply")
	}

	switch os.Args[1] {
	case "proxy":
		if err := runProxy(os.Args[2:]); err != nil {
			fatalf("%v", err)
		}
	case "apply":
		if err := runApply(os.Args[2:]); err != nil {
			fatalf("%v", err)
		}
	default:
		fatalf("unknown subcommand %q", os.Args[1])
	}
}

func runProxy(args []string) error {
	fs := flag.NewFlagSet("proxy", flag.ContinueOnError)
	configPath := fs.String("config", "", "path to gateway config file")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *configPath == "" {
		return errors.New("missing --config")
	}

	cfg, err := readConfig(*configPath)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var wg sync.WaitGroup

	for _, rt := range cfg.Routes {
		rt := rt
		switch rt.Mode {
		case "http", "https":
			wg.Add(1)
			go func() {
				defer wg.Done()
				if err := serveHTTP(ctx, rt); err != nil && !errors.Is(err, context.Canceled) {
					log.Printf("http proxy for %s failed: %v", rt.ID, err)
				}
			}()
		case "tcp", "tls-terminated-tcp":
			wg.Add(1)
			go func() {
				defer wg.Done()
				if err := serveTCP(ctx, rt); err != nil && !errors.Is(err, context.Canceled) {
					log.Printf("tcp proxy for %s failed: %v", rt.ID, err)
				}
			}()
		default:
			log.Printf("skipping route %s with unknown mode %q", rt.ID, rt.Mode)
		}
	}

	<-ctx.Done()
	wg.Wait()
	return nil
}

func runApply(args []string) error {
	fs := flag.NewFlagSet("apply", flag.ContinueOnError)
	configPath := fs.String("config", "", "path to gateway config file")
	socketPath := fs.String("socket", "", "tailscaled socket path")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *configPath == "" {
		return errors.New("missing --config")
	}
	if *socketPath == "" {
		return errors.New("missing --socket")
	}

	cfg, err := readConfig(*configPath)
	if err != nil {
		return err
	}

	if err := runTailCommand(*socketPath, "serve", "reset"); err != nil {
		return err
	}

	for _, rt := range cfg.Routes {
		switch rt.Mode {
		case "http":
			target := fmt.Sprintf("http://127.0.0.1:%d", rt.LocalPort)
			if err := runTailCommand(
				*socketPath,
				"serve",
				"--bg",
				fmt.Sprintf("--http=%d", rt.ExternalPort),
				target,
			); err != nil {
				return fmt.Errorf("apply http route %s: %w", rt.ID, err)
			}
		case "https":
			target := fmt.Sprintf("http://127.0.0.1:%d", rt.LocalPort)
			if err := runTailCommand(
				*socketPath,
				"serve",
				"--bg",
				fmt.Sprintf("--https=%d", rt.ExternalPort),
				target,
			); err != nil {
				return fmt.Errorf("apply https route %s: %w", rt.ID, err)
			}
		case "tcp":
			target := fmt.Sprintf("tcp://127.0.0.1:%d", rt.LocalPort)
			if err := runTailCommand(
				*socketPath,
				"serve",
				"--bg",
				fmt.Sprintf("--tcp=%d", rt.ExternalPort),
				target,
			); err != nil {
				return fmt.Errorf("apply tcp route %s: %w", rt.ID, err)
			}
		case "tls-terminated-tcp":
			target := fmt.Sprintf("tcp://127.0.0.1:%d", rt.LocalPort)
			if err := runTailCommand(
				*socketPath,
				"serve",
				"--bg",
				fmt.Sprintf("--tls-terminated-tcp=%d", rt.ExternalPort),
				target,
			); err != nil {
				return fmt.Errorf("apply tls-terminated-tcp route %s: %w", rt.ID, err)
			}
		default:
			return fmt.Errorf("unknown mode %q for route %s", rt.Mode, rt.ID)
		}
	}

	return nil
}

func serveHTTP(ctx context.Context, rt route) error {
	return serveHTTPAt(ctx, rt, "127.0.0.1:"+strconv.Itoa(rt.LocalPort))
}

func serveHTTPAt(ctx context.Context, rt route, listenAddr string) error {
	scheme := rt.TargetScheme
	if scheme == "" || scheme == "tcp" {
		scheme = "http"
	}
	parseScheme := scheme
	if scheme == "https+insecure" {
		parseScheme = "https"
	}

	targetURL, err := url.Parse(fmt.Sprintf("%s://%s:%d", parseScheme, rt.TargetHost, rt.TargetPort))
	if err != nil {
		return err
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	if scheme == "https+insecure" {
		proxy.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}
	proxy.ErrorLog = log.New(os.Stderr, "[tailscale-gateway-http] ", log.LstdFlags)

	server := &http.Server{
		Addr:    listenAddr,
		Handler: proxy,
	}

	errCh := make(chan error, 1)
	go func() {
		err := server.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
		return ctx.Err()
	case err := <-errCh:
		return err
	}
}

func serveTCP(ctx context.Context, rt route) error {
	listener, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(rt.LocalPort))
	if err != nil {
		return err
	}
	defer listener.Close()

	go func() {
		<-ctx.Done()
		_ = listener.Close()
	}()

	for {
		conn, err := listener.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			var netErr net.Error
			if errors.As(err, &netErr) && netErr.Temporary() {
				time.Sleep(250 * time.Millisecond)
				continue
			}
			return err
		}

		go handleTCPConn(ctx, conn, rt)
	}
}

func handleTCPConn(ctx context.Context, inbound net.Conn, rt route) {
	defer inbound.Close()

	outbound, err := (&net.Dialer{}).DialContext(ctx, "tcp", net.JoinHostPort(rt.TargetHost, strconv.Itoa(rt.TargetPort)))
	if err != nil {
		log.Printf("dial %s failed for %s: %v", rt.ID, net.JoinHostPort(rt.TargetHost, strconv.Itoa(rt.TargetPort)), err)
		return
	}
	defer outbound.Close()

	errCh := make(chan error, 2)

	go proxyCopy(errCh, outbound, inbound)
	go proxyCopy(errCh, inbound, outbound)

	<-errCh
}

func proxyCopy(errCh chan<- error, dst net.Conn, src net.Conn) {
	_, err := io.Copy(dst, src)
	_ = dst.SetDeadline(time.Now())
	errCh <- err
}

func readConfig(path string) (config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return config{Version: 1, Routes: []route{}}, nil
		}
		return config{}, err
	}

	var cfg config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return config{}, err
	}
	if cfg.Version == 0 {
		cfg.Version = 1
	}
	if cfg.Routes == nil {
		cfg.Routes = []route{}
	}
	return cfg, nil
}

func runTailCommand(socket string, args ...string) error {
	fullArgs := append([]string{"--socket=" + socket}, args...)
	cmd := exec.Command("tailscale", fullArgs...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func fatalf(format string, args ...any) {
	log.Printf(format, args...)
	os.Exit(1)
}
