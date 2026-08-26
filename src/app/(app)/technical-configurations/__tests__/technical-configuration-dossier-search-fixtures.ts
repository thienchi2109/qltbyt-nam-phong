export const technicalConfigurationDossierSearchNormalizationFixtures = [
  {
    name: "Vietnamese accents",
    input: "Máy siêu âm",
    expected: "may sieu am",
  },
  {
    name: "decomposed Unicode",
    input: "Ma\u0301y sie\u0302u a\u0302m",
    expected: "may sieu am",
  },
  {
    name: "hyphenated device type",
    input: "X-quang",
    expected: "x quang",
  },
  {
    name: "Vietnamese d stroke",
    input: "Đầu dò",
    expected: "dau do",
  },
  {
    name: "punctuation and separators",
    input: "Máy/X_quang-CT.MRI",
    expected: "may x quang ct mri",
  },
  {
    name: "repeated whitespace",
    input: "  Máy\t  siêu\n âm  ",
    expected: "may sieu am",
  },
  {
    name: "wildcard characters",
    input: "100%_\\ X-quang",
    expected: "100 x quang",
  },
  {
    name: "punctuation only",
    input: "%_\\-/.,",
    expected: "",
  },
  {
    name: "whitespace only",
    input: " \t\n ",
    expected: "",
  },
  {
    name: "empty input",
    input: "",
    expected: "",
  },
  {
    name: "one character",
    input: "đ",
    expected: "d",
  },
] as const

export const technicalConfigurationDossierSearchBoundaryFixtures = {
  atLimit: "a".repeat(200),
  overLimit: "a".repeat(201),
} as const
