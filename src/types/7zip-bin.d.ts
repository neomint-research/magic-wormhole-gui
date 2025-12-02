declare module '7zip-bin' {
  /**
   * Path to the 7za executable for the current platform.
   */
  export const path7za: string;

  /**
   * Path to the 7z executable for the current platform (Windows only).
   */
  export const path7z: string;

  /**
   * Path to the 7zr executable for the current platform.
   */
  export const path7zr: string;
}
