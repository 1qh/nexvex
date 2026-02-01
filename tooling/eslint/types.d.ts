declare module 'eslint-plugin-prefer-arrow-functions' {
  export const rules: Record<string, Rule.RuleModule>
}

declare module 'eslint-plugin-better-tailwindcss' {
  export const configs: {
    'recommended-error': { rules: Linter.RulesRecord }
  }
  export const rules: Record<string, Rule.RuleModule>
}
