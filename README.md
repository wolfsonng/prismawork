# 🚀 PrismaWork

> **A beautiful, UI-first tool for managing Prisma projects with multi-environment support**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)

A comprehensive local development tool that brings the power of Prisma to your browser. Manage multiple projects, test database connections, and execute Prisma commands with a beautiful, intuitive interface.

## ✨ Features

### 🎯 **Multi-Project Management**
- **Unique Project IDs**: Each project gets a unique identifier for easy management
- **Project Switching**: Seamlessly switch between projects with preserved settings
- **Duplicate Prevention**: Smart validation prevents duplicate project paths and names
- **Inline Editing**: Edit project names and paths directly in the UI

### 🔗 **Database Connection Management**
- **Multi-Environment Support**: Local, staging, and production profiles per project
- **Connection Testing**: Test all database types (Local, Shadow, Supabase Direct/Pooled)
- **SSL Certificate Handling**: Automatic handling of self-signed certificates
- **Real-time Validation**: Instant feedback on connection status and latency

### ⚡ **Prisma Integration**
- **One-Click Commands**: Execute Prisma commands with a single click
- **Migration Management**: Track applied migrations and migration status
- **Schema Operations**: Generate, format, diff, and pull schemas
- **Prisma Studio**: Integrated Prisma Studio with custom port configuration

### 🛡️ **Security & Privacy**
- **Local-Only**: Backend binds to `127.0.0.1` with strict CORS policies
- **No Data Leakage**: All sensitive data stays on your machine
- **Git-Safe**: Project data is automatically gitignored

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- A Prisma project (or create one with `npx prisma init`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/wolfsonng/prismawork.git
   cd prismawork
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install server dependencies
   cd server && npm install && cd ..
   ```

3. **Start the application**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - **Frontend**: http://localhost:6581
   - **Backend API**: http://localhost:6580

## 📖 Usage Guide

### Creating Your First Project

1. **Open the application** at http://localhost:6581
2. **Click "New Project"** to create your first project
3. **Enter project details**:
   - **Name**: A descriptive name for your project
   - **Path**: The absolute path to your Prisma project directory
4. **Click "Create Project"** to save

### Configuring Database Connections

1. **Select your project** from the project switcher
2. **Choose an environment profile** (local/staging/prod)
3. **Configure database URLs**:
   - `LOCAL_DATABASE_URL`: Your local database
   - `SHADOW_DATABASE_URL`: For migrations (optional)
   - `DATABASE_URL`: Production/pooled connection
   - `DIRECT_URL`: Direct database connection
4. **Test connections** using the "Test" buttons
5. **Save your configuration**

### Managing Multiple Projects

- **Switch Projects**: Use the project cards to switch between projects
- **Edit Projects**: Click "Edit" to modify project names or paths
- **Delete Projects**: Remove projects you no longer need
- **Validate Paths**: Ensure project directories contain valid Prisma setups

## 🏗️ Project Structure

```
prismawork/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── pages/             # Application pages
│   └── utils/             # Frontend utilities
├── server/                # Node.js backend
│   ├── src/               # Server source code
│   └── data/              # Project data (gitignored)
├── docs/                  # Documentation
└── README.md
```

## 🔧 Development

### Available Scripts

```bash
# Development (both frontend and backend)
npm run dev

# Frontend only
npm run client:dev

# Backend only  
npm run server:dev

# Production build
npm run build:all

# Start production server
npm start
```

### Environment Variables

Create a `.env` file in your project root:

```env
# Optional: Custom backend port
PORT=6580

# Your database URLs (configured via UI)
LOCAL_DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
DATABASE_URL="postgresql://user:password@remote:5432/mydb"
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### 🐛 **Bug Reports**
- Use GitHub Issues to report bugs
- Include steps to reproduce
- Provide system information (OS, Node.js version)

### 💡 **Feature Requests**
- Open an issue with the "enhancement" label
- Describe the use case and expected behavior
- Consider contributing the implementation!

### 🔨 **Code Contributions**

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Add tests** (if applicable)
5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### 🎯 **Areas for Contribution**

- **UI/UX Improvements**: Better user experience, accessibility
- **Database Support**: Additional database providers
- **Performance**: Optimize connection testing and data loading
- **Documentation**: Improve guides, add examples
- **Testing**: Add unit tests, integration tests
- **Internationalization**: Multi-language support

### 📋 **Development Guidelines**

- **Code Style**: Follow existing TypeScript/React patterns
- **Commits**: Use conventional commit messages
- **Testing**: Test your changes thoroughly
- **Documentation**: Update docs for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Prisma Team** for the amazing ORM and tools
- **React Community** for the excellent ecosystem
- **Contributors** who help make this project better

## 📞 Support

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and community support
- **Documentation**: Check the `/docs` folder for detailed guides

---

**Made with ❤️ by the community**

*Star ⭐ this repository if you find it helpful!*