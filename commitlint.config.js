export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation
        'style', // Code style (formatting, semicolons, etc.)
        'refactor', // Code refactoring
        'perf', // Performance improvement
        'test', // Adding tests
        'chore', // Build process, tooling, etc.
        'security', // Security fix
        'revert', // Revert commit
      ],
    ],
    'subject-max-length': [2, 'always', 100],
  },
};
