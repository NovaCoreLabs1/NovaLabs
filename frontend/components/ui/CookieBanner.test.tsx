import { fireEvent, render, screen } from "@testing-library/react";
import { CookieBanner } from "@/components/ui/CookieBanner";
import {
  readCurrentConsent,
  useCookieConsent,
} from "@/lib/hooks/useCookieConsent";
import { act, renderHook } from "@testing-library/react";

// `react-cookie-consent` ships with a default export that renders a `<div>`
// containing the banner children and two buttons. We rely on that
// contract here.

describe("CookieBanner", () => {
  it("renders the banner copy with accept / decline buttons", () => {
    render(<CookieBanner />);
    expect(
      screen.getByText(/strictly-necessary cookies/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Accept/i)).toBeInTheDocument();
    expect(screen.getByText(/Decline/i)).toBeInTheDocument();
  });

  it("dispatches a consent_changed event with detail=accept on click", () => {
    const listener = jest.fn();
    render(<CookieBanner />);
    window.addEventListener("consent_changed", listener);
    fireEvent.click(screen.getByText(/^Accept$/));
    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toBe("accept");
    window.removeEventListener("consent_changed", listener);
  });

  it("dispatches a consent_changed event with detail=decline on click", () => {
    const listener = jest.fn();
    render(<CookieBanner />);
    window.addEventListener("consent_changed", listener);
    fireEvent.click(screen.getByText(/^Decline$/));
    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toBe("decline");
    window.removeEventListener("consent_changed", listener);
  });
});

describe("useCookieConsent", () => {
  it("returns null before any cookie is set", () => {
    document.cookie = "cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const { result } = renderHook(() => useCookieConsent());
    expect(result.current).toBeNull();
  });

  it("reacts to consent_changed window events", () => {
    document.cookie = "cookie_consent=true";
    const { result } = renderHook(() => useCookieConsent());
    expect(result.current).toBe("accept");

    document.cookie = "cookie_consent=false";
    act(() => {
      window.dispatchEvent(new CustomEvent("consent_changed"));
    });
    expect(result.current).toBe("decline");
  });
});

describe("readCurrentConsent (sync helper)", () => {
  it("returns the accept / decline state from the cookie", () => {
    document.cookie = "cookie_consent=true";
    expect(readCurrentConsent()).toBe("accept");
    document.cookie = "cookie_consent=false";
    expect(readCurrentConsent()).toBe("decline");
    document.cookie = "cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    expect(readCurrentConsent()).toBeNull();
  });
});
