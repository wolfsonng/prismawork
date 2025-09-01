# Contributing to PrismaWork

Thank you for your interest in contributing to PrismaWork! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Git
- A code editor (VS Code recommended)

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/wolfsonng/prismawork.git
   cd prismawork
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Verify the setup**
   - Frontend: http://localhost:6581
   - Backend: http://localhost:6580

## 🎯 How to Contribute

### 🐛 Reporting Bugs

1. **Check existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - System information (OS, Node.js version)
   - Screenshots (if applicable)

### 💡 Suggesting Features

1. **Open a feature request issue**
2. **Describe the use case** and expected behavior
3. **Consider contributing** the implementation yourself!

### 🔨 Code Contributions

#### Types of Contributions We Welcome

- **Bug fixes**
- **New features**
- **UI/UX improvements**
- **Performance optimizations**
- **Documentation updates**
- **Test coverage**
- **Accessibility improvements**

#### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run the development server
   npm run dev
   
   # Test your changes thoroughly
   # Check both frontend and backend functionality
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📋 Coding Standards

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow existing naming conventions
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

### React Components
- Use functional components with hooks
- Follow the existing component structure
- Use TypeScript interfaces for props
- Keep components focused and reusable

### Backend Code
- Use Express.js patterns consistently
- Add proper error handling
- Validate input data
- Use TypeScript types

### Git Commit Messages
We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat: add new feature
fix: resolve bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add or update tests
chore: maintenance tasks
```

## 🧪 Testing

### Manual Testing
- Test all new features thoroughly
- Verify existing functionality still works
- Test with different project configurations
- Check error handling scenarios

### Test Scenarios
- **Project Management**: Create, edit, delete, switch projects
- **Database Connections**: Test various database types and configurations
- **Prisma Commands**: Verify all Prisma operations work correctly
- **Error Handling**: Test invalid inputs and connection failures

## 📁 Project Structure

```
prismawork/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── ProjectRootPanel.tsx  # Project management
│   │   └── ...
│   ├── pages/             # Application pages
│   ├── utils/             # Frontend utilities
│   └── App.tsx            # Main app component
├── server/                # Node.js backend
│   ├── src/               # Server source code
│   │   ├── index.ts       # Main server file
│   │   ├── projectStore.ts # Project data management
│   │   ├── pgUtil.ts      # Database utilities
│   │   └── ...
│   └── data/              # Project data (gitignored)
├── docs/                  # Documentation
└── README.md
```

## 🎨 UI/UX Guidelines

### Design Principles
- **Simplicity**: Keep the interface clean and intuitive
- **Consistency**: Follow existing design patterns
- **Accessibility**: Ensure the app is usable by everyone
- **Responsiveness**: Work well on different screen sizes

### Component Guidelines
- Use Tailwind CSS for styling
- Follow the existing color scheme
- Use Lucide React for icons
- Maintain consistent spacing and typography

## 🔍 Code Review Process

### What We Look For
- **Functionality**: Does the code work as intended?
- **Code Quality**: Is the code clean and maintainable?
- **Performance**: Are there any performance implications?
- **Security**: Are there any security concerns?
- **Documentation**: Is the code well-documented?

### Review Checklist
- [ ] Code follows project conventions
- [ ] Tests pass (if applicable)
- [ ] Documentation is updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance impact is considered

## 🚀 Release Process

1. **Feature branches** are merged into `main`
2. **Version tags** are created for releases
3. **Changelog** is updated with new features and fixes
4. **GitHub releases** are created with release notes

## 💬 Community Guidelines

### Be Respectful
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Focus on what's best for the community
- Show empathy towards other community members

### Be Constructive
- Provide constructive feedback
- Help others learn and grow
- Share knowledge and resources
- Be patient with newcomers

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community chat
- **Documentation**: Check the `/docs` folder
- **Code Comments**: Look at existing code for examples

## 🏆 Recognition

Contributors will be recognized in:
- **README.md** acknowledgments
- **GitHub contributors** list
- **Release notes** for significant contributions

Thank you for contributing to PrismaWork! 🎉
