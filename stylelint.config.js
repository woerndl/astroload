export default {
  extends: ['stylelint-config-standard'],
  overrides: [{ files: ['**/*.astro'], customSyntax: 'postcss-html' }],
  rules: {
    'declaration-no-important': true,
    // The starter ships no class or custom property naming rules. A project adds its own.
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    // Astro scoped styles use :global() to exempt a selector from scoping.
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
    // iOS Safari reads text-size-adjust only with the -webkit- prefix.
    'property-no-vendor-prefix': [true, { ignoreProperties: ['-webkit-text-size-adjust'] }],
  },
}
