// Minimal ambient shim so TypeScript resolves 'midi-writer-js' when the
// package.json "exports" map omits a "types" condition.
// The real types live at build/types/main.d.ts — re-export them here.
declare module "midi-writer-js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MidiWriter: any;
  export default MidiWriter;
}
