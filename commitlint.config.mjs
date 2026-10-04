// Conventional Commits: <tipo>(<scope>): <descripción>
// Scopes sugeridos = proyectos Nx + áreas transversales.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'api',
        'backoffice',
        'tv-display',
        'contracts',
        'design-tokens',
        'ui',
        'infra',
        'docs',
        'ai',
        'ci',
        'deps',
        'repo',
      ],
    ],
    'subject-case': [0],
  },
};
