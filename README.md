# Bun + Elysia + SQLite Real-Time Chords App

A simple project demonstrating how to build a type-safe API using a fully integrated Bun.js stack: Elysia, Bun's native SQLite driver, Kysely, and Vite.

## Setup

1.  **Install Bun:**
    This project is optimized for the Bun runtime. If you don't have it, install it:
    ```bash
    curl -fsSL https://bun.sh/install | bash
    ```

2.  **Install Dependencies:**
    ```bash
    bun install
    ```

3.  **Run Migrations:**
    Create the `chord` table in your `chords.db` file by running the migration script with Bun.
    ```bash
    bun db:migrate
    ```

4.  **Generate Database Types:**
    Run `kysely-codegen` to generate TypeScript types from your database schema. This uses the `bun-sqlite` dialect.
    ```bash
    bun db:generate-types
    ```

## Running the Application

This project uses Vite to serve the frontend client and Elysia for the backend API.

1.  **Start the Development Server:**
    This single command will start both the Elysia backend (with hot-reloading via `--watch`) and the Vite dev server for the client.
    ```bash
    bun dev
    ```

2.  **Open in Browser:**
    Open your browser and navigate to the URL provided by the Vite dev server (usually `http://localhost:5173`).

## How to Use

1.  Click the **"Start Audio"** button to enable sound.
2.  Type musical notes into the text area. The music will update as you type.
3.  Enter a name for your pattern in the "Pattern Name" input field.
4.  Click **"Save Pattern"** to save your creation to the database.
5.  Use the dropdown menu to **load a previously saved pattern** back into the editor.
