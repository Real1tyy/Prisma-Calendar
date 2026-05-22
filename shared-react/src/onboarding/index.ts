export type { WelcomeModalFooterLink, WelcomeModalShellProps } from "./welcome-modal-shell";
export { WelcomeModalShell } from "./welcome-modal-shell";

// ─── Guided tour engine (react-joyride) ───
export { startTour } from "./tour-host";
export { TourTooltip } from "./tour-tooltip";
export { buildTourJoyrideOptions, buildTourStyles, TOUR_Z_INDEX } from "./tour.styles";
export type { TourHandle, TourOptions, TourStep, TourTarget } from "./tour-types";
export { waitForElement } from "./wait-for-element";
