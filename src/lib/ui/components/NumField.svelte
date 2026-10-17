<script lang="ts">
  /**
   * A number input that only commits valid values: rounded to `step`, inside [min, max].
   * Half-typed values (an empty box, "1." on the way to "1.5") are ignored rather than
   * clamped, and the box snaps back to the real value when it loses focus.
   */
  interface Props {
    value: number;
    min: number;
    max: number;
    step: number;
    /** Multiply the stored value by this for display (e.g. days stored, weeks shown). */
    scale?: number;
    disabled?: boolean;
    onset: (v: number) => void;
  }
  let { value, min, max, step, scale = 1, disabled = false, onset }: Props = $props();

  // The shortest form of the value ("2", "1.5"), never padded: "2.0" would show as "2,0" in some locales.
  const decimals = $derived(step < 1 ? String(step).split('.')[1]!.length : 0);
  const shown = $derived(String(+(value * scale).toFixed(decimals)));

  function commit(el: HTMLInputElement) {
    const v = Math.round(el.valueAsNumber / step) * step;
    if (el.value === '' || !Number.isFinite(v) || v < min || v > max) return;
    onset(+(v / scale).toFixed(10));
  }
</script>

<input
  type="number"
  {min}
  {max}
  {step}
  {disabled}
  value={shown}
  oninput={(e) => commit(e.currentTarget)}
  onchange={(e) => {
    commit(e.currentTarget);
    e.currentTarget.value = shown;
  }}
/>
