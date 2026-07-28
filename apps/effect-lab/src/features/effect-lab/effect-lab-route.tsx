import { EffectLab } from "./effect-lab";

/**
 * Deliberately ordinary React. Effect requirements begin and end beneath this
 * route boundary.
 */
export function EffectLabRoute() {
  return (
    <div data-boundary="react-route">
      <EffectLab />
    </div>
  );
}
