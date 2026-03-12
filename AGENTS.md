# AGENT.md


### Code Style
- **TypeScript**: Strict mode in app, relaxed in common
- **Formatting**: Prettier with 2 spaces, no semicolons, single quotes
- **Testing**: Colocated tests in `src/**/*.test.{ts,tsx}`
- **Imports**: ES6 modules, prefer named imports

### Clean Code Practices
We follow clean code principles to maintain a high-quality, maintainable codebase:

- **SOLID Principles**: Apply Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles where appropriate
- **Testability First**: Design components and functions to be easily testable with clear inputs, outputs, and minimal dependencies
- **Simplicity Over Complexity**: Balance clean code practices with pragmatism - prefer simple, straightforward solutions over over-engineered ones
- **Avoid Over-Abstraction**: Don't create abstractions prematurely. Three similar instances can justify an abstraction, but one or two should remain concrete
- **Dependency Injection**: Favor dependency injection for better testability and loose coupling
- **Pure Functions**: Prefer pure functions and immutability where practical (especially in the Survey model)
- **Clear Intent**: Write self-documenting code with descriptive names; avoid unnecessary comments that restate what the code does
- **No unused imports**: Remove any imports that are not referenced in the file

## Documentation Guidelines

### Documentation Philosophy

Documentation should be **concise, scannable, and focused**. The code is the authoritative source - documentation explains **what** and **why**, not **how**.

**Core Principles**:
1. **Extreme conciseness** - Aim for 50-70% less content than your first draft
2. **No duplication** - Each concept documented in ONE place only
3. **Extensive cross-referencing** - Link to canonical locations instead of repeating
4. **Essential commands only** - Remove verbose explanations and duplicate examples
5. **Link to external resources** - Instead of copying documentation
6. **Separate, focused files** - Each file covers one topic, laser-focused

**Target metrics**:
- Individual docs: 100-500 lines max (not 500-1000)
- Commands: Show once, link elsewhere
- Examples: One per concept (not multiple variations)

### When to Simplify Documentation

**Aggressive simplification is the default.** Simplify when:
- File exceeds 500 lines
- Multiple files explain the same concept
- Verbose explanations that could be condensed to bullet points
- Multiple command examples when one would suffice
- Installation/setup instructions that duplicate official docs
- Troubleshooting that could link to a central troubleshooting doc

### Documentation Structure

For feature documentation, prefer **fewer, more focused files**:

**Option 1: Single page (preferred for simple features)**
- 100-500 lines total
- Overview + key concepts + quick start + links to source

**Option 2: README + multiple feature pages (for moderate complexity)**
1. **README.md** (~50-300 lines)
   - One-paragraph overview
   - Quick start commands
   - Links to guide and source files

2. **{feature}.md** (~100-500 lines)
   - Core concepts (bullet points, not paragraphs)
   - Essential commands/examples (one per concept)
   - ASCII diagram if helpful
   - Link to troubleshooting doc

**Total target**: 150-1500 lines across all files

**Anti-pattern**: Creating separate files for system/lifecycle/API that repeat the same information. Consolidate into one focused guide.

### What to Include

**DO include**:
- One-paragraph overview
- Essential commands/examples (one per concept)
- ASCII diagram (only if it clarifies architecture)
- Links to source files and external docs
- Links to troubleshooting doc (not inline troubleshooting)

**DO NOT include**:
- Verbose explanations (use bullet points)
- Multiple examples of the same concept
- Installation instructions (link to official docs)
- Duplicate commands across multiple files
- Troubleshooting sections (centralize in one troubleshooting.md)
- YAML/JSON examples that duplicate source code
- "How it works" explanations (code comments are better)
- Step-by-step walkthroughs (link to source)
- Best practices sections with YAML examples
- Separate files for similar topics (consolidate instead)

### Using Diagrams Effectively

**ASCII diagrams are preferred** for:
- Portability (work in any text viewer)
- Easy to edit and version control
- Fast to create

**Diagram types**:

1. **State transitions**:
```
[Created] → [Active] → [Deleted]
               ↓           ↓
           [In Use]   [Archived]
```

2. **Flowcharts**:
```
Input
  ↓
Process
  ↓
┌─────┬─────┐
│ Yes │ No  │
│  ↓  │  ↓  │
│  A  │  B  │
└─────┴─────┘
```

3. **Hierarchies**:
```
Parent
├── Child A
│   └── Grandchild 1
└── Child B
    └── Grandchild 2
```

4. **Data flow**:
```
[Component A] → [Component B] → [Component C]
                      ↓
                [Component D]
```

### Trimming Strategies (Proven Effective)

**1. Consolidate duplicate commands**:
```bash
# Before (verbose, repeated in 5 files):
# Check pod status
kubectl get pods -n namespace
kubectl describe pod <pod-name> -n namespace
kubectl logs <pod-name> -n namespace

# After (concise, in one place):
kubectl get pods -n namespace
kubectl logs <pod-name> -n namespace
```

**2. Remove verbose explanations**:
```markdown
# Before:
This command will check the status of all pods in the namespace.
It's important to verify that all pods are running correctly before
proceeding with the deployment.

# After:
Check pod status:
```

**3. Replace sections with links**:
```markdown
# Before: 50 lines of troubleshooting
## Troubleshooting
### Issue 1...
### Issue 2...

# After: 2 lines
## Troubleshooting
See [troubleshooting.md](troubleshooting.md#feature-name) for issues.
```

**4. Remove installation/setup duplication**:
```markdown
# Before: Copying official installation steps
# After: Link to official docs
Installation: See [official docs](https://example.com/install)
```

**5. Consolidate examples**:
```markdown
# Before: 3-4 similar examples showing variations
# After: 1 focused example + "See code for more examples"
```

### Documentation Maintenance

**DRY Principle (Don't Repeat Yourself)**:
- Each topic documented in ONE canonical location only
- All other files link to the canonical location
- When updating, update the canonical location once
- Remove duplicate content immediately

**Canonical location strategy**:
- Choose the most logical file for each topic
- Add "See [topic](canonical-file.md)" links elsewhere
- Update old references to link instead of duplicate

**When updating docs**:
- Trim verbose explanations to bullet points
- Remove duplicate commands/examples
- Update links when files move
- Keep line counts under 200 per file
- Consolidate if multiple files cover same topic

**When NOT to document**:
- Anything already in official external docs (link instead)
- Troubleshooting (centralize in troubleshooting.md)
- Installation steps (link to official installation docs)
- Configuration details (show minimal example, link to source)
- Implementation details (code comments are better)
