export const trimAndRemoveDoubleQuotes = (str: string) =>
  str.trim().replaceAll('"', '')
