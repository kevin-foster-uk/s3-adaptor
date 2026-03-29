module.exports = {
  types: [
    { value: 'feat',     name: 'feat:     A new feature' },
    { value: 'fix',      name: 'fix:      A bug fix' },
    { value: 'refactor', name: 'refactor: Code change without behaviour change' },
    { value: 'chore',    name: 'chore:    Maintenance, dependencies, tooling' },
    { value: 'docs',     name: 'docs:     Documentation only' },
    { value: 'test',     name: 'test:     Adding or updating tests' },
    { value: 'ci',       name: 'ci:       CI/CD pipeline changes' },
    { value: 'build',    name: 'build:    Build system changes' },
  ],
  allowCustomScopes: true,
  subjectLimit: 72,
  skipQuestions: ['body', 'breaking', 'footer'],
  messages: {
    type:          'Select the type of change:',
    scope:         'Scope (optional — e.g. upload, presign, middleware):',
    subject:       'Short summary (imperative, present tense, ≤72 chars):',
    confirmCommit: 'Commit with this message?',
  },
  additionalQuestions: [
    {
      type: 'input',
      name: 'body',
      message: 'Describe the new capability (optional — explain WHY, not what):',
      when: (a) => a.type === 'feat',
    },
    {
      type: 'input',
      name: 'body',
      message: 'What does this fix and what caused it? (optional):',
      when: (a) => a.type === 'fix',
    },
    {
      type: 'confirm',
      name: 'isBreaking',
      message: 'Is this a breaking change?',
      default: false,
      when: (a) => a.type === 'feat' || a.type === 'fix',
    },
    {
      type: 'input',
      name: 'breaking',
      message: 'Describe the breaking change:',
      when: (a) => a.isBreaking,
    },
    {
      type: 'input',
      name: 'footer',
      message: 'Issues closed (e.g. Closes #123):',
      when: (a) => a.type === 'fix',
    },
  ],
}
