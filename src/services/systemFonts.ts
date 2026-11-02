// fonts every computer already has. they are never fetched from Google, and each falls back to its look-alike.

const STACKS: Record<string, string> = {
  'Times New Roman': '"Times New Roman", Times, "Liberation Serif", serif',
  Helvetica: 'Helvetica, "Helvetica Neue", Arial, "Liberation Sans", sans-serif',
  Arial: 'Arial, Helvetica, "Liberation Sans", sans-serif',
};

export const SYSTEM_FONTS = Object.keys(STACKS);

export const isSystemFont = (family: string | undefined): boolean => !!family && family in STACKS;

// the css font-family value for a system font
export const systemStack = (family: string): string => STACKS[family];
