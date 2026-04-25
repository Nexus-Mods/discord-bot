type Rule = {
    id: Readonly<number>,
    targets: RuleTarget,
    pattern_type: PatternType,
    pattern: string,
    points: number,
    text_fields: TextFields,
    description: string,
    game_domain: string | null,
    exclude_mods: string | null,
    exclude_users: string | null
}

enum RuleTarget {
    Mod = 1 << 0,
    File = 1 << 1,
    User = 1 << 2,
    Video = 1 << 3
}

enum PatternType {
    StartsWith = 1,
    EndsWith = 2,
    Contains = 3,
    Regex = 4,
    Equals = 5
}

const TextFields = {
  Name: 1 << 0,         // 1
  Summary: 1 << 1,      // 2
  Description: 1 << 2,  // 4
  Author: 1 << 3,       // 8
  UploaderName: 1 << 4, // 16
  Requirements: 1 << 5, // 32
  Mirrors: 1 << 6,      // 64
  Content: 1 << 7,      // 128
  Extensions: 1 << 8,   // 256
  Title: 1 << 9         // 512
}

type TextFields = typeof TextFields[keyof typeof TextFields]

export { Rule };