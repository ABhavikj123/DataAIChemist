# DataAIChemist

DataAIChemist is a data-centric web application built with [Next.js](https://nextjs.org), designed for advanced data validation, correction, and management using AI-powered workflows. It supports CSV/XLSX import/export, natural language search and modification, business rule editing, and more.

---

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

3. **Open your browser:**
   Visit [http://localhost:3000](http://localhost:3000) to use the app.

---

## 📂 Sample Data

Sample CSV files (`clients.csv`, `workers.csv`, `tasks.csv`) are included in the `public` folder.

**To test with sample data:**
- Go to the main page of the app.
- Click the **"Upload Sample Data"** button.
- The app will automatically load the sample datasets for you to explore and test features.

---

## ✨ Features

- **AI-powered Data Validation & Correction:**  
  Use Gemini AI to check, validate, and auto-correct your datasets.
- **CSV/XLSX Import & Export:**  
  Upload and download data in standard formats.
- **Natural Language Search & Modification:**  
  Query and update your data using plain English.
- **Business Rule Editor:**  
  Add, edit, and manage business rules with natural language support.
- **Priority & Heuristic Settings:**  
  Fine-tune task assignment logic with adjustable weights and criteria.
- **Comprehensive UI:**  
  Modern, responsive interface built with Shadcn UI and Lucide icons.

---

## 🗂️ Project Structure

```
src/
  components/         # React components (DataGrid, NaturalSearch, RulesEditor, etc.)
  lib/                # Utility libraries (AI, CSV/XLSX parsing, validation, etc.)
  store/              # Redux store and slices
  types/              # TypeScript type definitions
public/
  clients.csv         # Sample client data
  workers.csv         # Sample worker data
  tasks.csv           # Sample task data
```

---

## 📝 Customization

- **Add your own data:**  
  Use the upload feature to import your own CSV/XLSX files.
- **Edit rules and priorities:**  
  Use the Rules Editor and Priority Settings to customize business logic.

---

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Shadcn UI](https://ui.shadcn.com/)
- [Lucide Icons](https://lucide.dev/)
- [PapaParse (CSV)](https://www.papaparse.com/)
- [xlsx (SheetJS)](https://sheetjs.com/)

---

## 🚀 Deploy

Deploy easily on [Vercel](https://vercel.com/) or your preferred platform.  
See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## 🤖 AI API

This project uses the Gemini API for AI-powered features.  
Set your API key in your environment variables as `NEXT_PUBLIC_GEMINI_API_KEY`.

---

## 🧪 Contributing

Pull requests and feedback are welcome!

---

**Enjoy exploring and managing your data with DataAIChemist!**