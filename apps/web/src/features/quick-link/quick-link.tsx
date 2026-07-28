import type { LinkComponent } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import { forwardRef, useRef, useSyncExternalStore } from "react";
import { createLink } from "@tanstack/react-router";

function getPointerSnapshot() {
  const canHover = window.matchMedia("(hover: hover)").matches;
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;

  if (!canHover || isCoarse) {
    return "touch";
  }

  return "hover";
}

function subscribeToPointerCapability(onStoreChange: () => void) {
  const hoverMediaQuery = window.matchMedia("(hover: hover)");
  const coarsePointerMediaQuery = window.matchMedia("(pointer: coarse)");

  hoverMediaQuery.addEventListener("change", onStoreChange);
  coarsePointerMediaQuery.addEventListener("change", onStoreChange);

  return () => {
    hoverMediaQuery.removeEventListener("change", onStoreChange);
    coarsePointerMediaQuery.removeEventListener("change", onStoreChange);
  };
}

function getServerSnapshot() {
  return undefined;
}

function useHasTouch() {
  const capability = useSyncExternalStore(
    subscribeToPointerCapability,
    getPointerSnapshot,
    getServerSnapshot,
  );

  return {
    isKnown: capability !== undefined,
    isTouchPrimary: capability === "touch",
  };
}

function canQuickNavigate({
  event,
  href,
  target,
}: {
  event: MouseEvent<HTMLAnchorElement>;
  href: string | undefined;
  target: string | undefined;
}) {
  if (
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return false;
  }

  const elementTarget = event.currentTarget.getAttribute("target");
  const effectiveTarget = target ?? elementTarget;

  if (effectiveTarget && effectiveTarget !== "_self") {
    return false;
  }

  if (!href) {
    return false;
  }

  const url = new URL(href, window.location.href);
  return url.origin === window.location.origin;
}

const QuickAnchor = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithoutRef<"a">
>(({ href, onClick, onMouseDown, target, ...props }, ref) => {
  const skipNextClickRef = useRef(false);

  function handleMouseDown(event: MouseEvent<HTMLAnchorElement>) {
    onMouseDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (!canQuickNavigate({ event, href, target })) {
      return;
    }

    skipNextClickRef.current = true;
    onClick?.(event);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (skipNextClickRef.current) {
      skipNextClickRef.current = false;
      event.preventDefault();
      return;
    }

    onClick?.(event);
  }

  return (
    <a
      {...props}
      ref={ref}
      href={href}
      target={target}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    />
  );
});

QuickAnchor.displayName = "QuickAnchor";

const CreatedLink = createLink(QuickAnchor);

export const QuickLink = ((props) => {
  const { isTouchPrimary, isKnown } = useHasTouch();
  const preload =
    props.preload ?? (isKnown && isTouchPrimary ? "viewport" : "intent");

  return <CreatedLink preload={preload} {...props} />;
}) satisfies LinkComponent<typeof QuickAnchor>;
