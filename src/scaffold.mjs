import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { execa } from "execa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const run = (cmd, args, opts = {}) => execa(cmd, args, { stdio: "inherit", ...opts });

export async function scaffold({ appName, packageManager = "npm", install = true }) {
  const appDir = path.resolve(process.cwd(), appName);

  if (await fs.pathExists(appDir)) {
    const files = await fs.readdir(appDir);
    if (files.length) throw new Error(`Directory '${appName}' already exists and is not empty.`);
  } else {
    await fs.mkdirp(appDir);
  }

  // 1) Create Vite + React (JS)
  const viteArgsByPM = {
    npm: ["create", "vite@latest", appName, "--", "--template", "react"],
    pnpm: ["create", "vite", appName, "--template", "react"],
    yarn: ["create", "vite", appName, "--template", "react"],
    bun: ["x", "create-vite", appName, "--template", "react"]
  };

  let cmd = "npm";
  let args = viteArgsByPM.npm;
  if (packageManager === "pnpm") { cmd = "pnpm"; args = viteArgsByPM.pnpm; }
  else if (packageManager === "yarn") { cmd = "yarn"; args = viteArgsByPM.yarn; }
  else if (packageManager === "bun") { cmd = "bun"; args = viteArgsByPM.bun; }

  await run(cmd, args, { cwd: process.cwd() });

  // 2) Install deps
  if (install) {
    await run(packageManager, ["install"], { cwd: appDir });
    await run(packageManager, ["add", "-D", "sass"], { cwd: appDir });
    await run(packageManager, ["add", "@reduxjs/toolkit", "react-redux", "axios", "react-hot-toast"], { cwd: appDir });
  }

  // 3) Create folders
  const src = path.join(appDir, "src");
  const mk = p => fs.mkdirp(path.join(src, p));
  await Promise.all([
    mk("__tests__"),
    mk("assets"),
    mk("components/UserControls"),
    mk("external"),
    mk("helpers"),
    mk("hooks"),
    mk("redux"),
    mk("styles/abstract"),
    mk("styles/pages")
  ]);
  await fs.mkdirp(path.join(appDir, "public"));

  // 4) Files

  // HomeLayout.jsx template
  const homeLayout = `import { useDispatch } from "react-redux";
import { useGlobalHook } from "./hooks/useGlobalHook";
import { setWelcomeMessage } from "./redux/globalSlice";

export default function HomeLayout() {
  const { welcomeMessage } = useGlobalHook();
  const dispatch = useDispatch();

  const handleClick = () => {
    dispatch(setWelcomeMessage("hey i am in In hello"));
  };

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <header>
        <h1>HomeLayout</h1>
        <p>Welcome message from Redux: <strong>{welcomeMessage}</strong></p>
      </header>

      <section>
        <button onClick={handleClick} className="btn-change">
          Change Welcome Message
        </button>
      </section>
    </main>
  );
}
`;
  await fs.writeFile(path.join(src, "HomeLayout.jsx"), homeLayout);

  // helpers
  await fs.writeFile(path.join(src, "helpers", "helperFunctions.js"), `export const JPJS = (x)=>JSON.parse(JSON.stringify(x));\n`);
  await fs.writeFile(path.join(src, "helpers", "screenMappers.jsx"), `export const screens = {}; // add mappings here\n`);

  // hooks: only global hook
  const globalHook = `import { useSelector, useDispatch } from "react-redux";
export const useGlobalHook = () => {
  const dispatch = useDispatch();
  const welcomeMessage = useSelector((s) => s.global.welcomeMessage);
  return { dispatch, welcomeMessage };
};
`;
  await fs.writeFile(path.join(src, "hooks", "useGlobalHook.js"), globalHook);

  // redux: initialState, slice, store
  const initialState = `export const initialState = {
  global: {
    welcomeMessage: "hello",
  },
};
`;
  await fs.writeFile(path.join(src, "redux", "initialState.js"), initialState);

  const globalSlice = `import { createSlice } from "@reduxjs/toolkit";
import { initialState } from "./initialState";

const globalSlice = createSlice({
  name: "global",
  initialState: initialState.global,
  reducers: {
    setWelcomeMessage(state, action) {
      state.welcomeMessage = action.payload;
    },
  },
});

export const { setWelcomeMessage } = globalSlice.actions;
export default globalSlice.reducer;
`;
  await fs.writeFile(path.join(src, "redux", "globalSlice.js"), globalSlice);

  const store = `import { configureStore } from "@reduxjs/toolkit";
import global from "./globalSlice";

export const store = configureStore({
  reducer: {
    global,
  },
});

export default store;
`;
  await fs.writeFile(path.join(src, "redux", "store.js"), store);

  // external: custom axios + thunk
  const customAxiosInstance = `import axios from "axios";

export const customAxios = axios.create({
  baseURL: localStorage.getItem("API_ENDPOINT"),
});
`;
  await fs.writeFile(path.join(src, "external", "customAxiosInstance.js"), customAxiosInstance);

  const apiJs = `import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { customAxios } from "./customAxiosInstance";

export const fetchConfig = createAsyncThunk(
  "getConfigJson",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get("/config.json");
      const data = await res.data;
      localStorage.setItem("API_ENDPOINT", data.apiEndpoint);
      customAxios.defaults.baseURL = localStorage.getItem("API_ENDPOINT");
      return data;
    } catch (err) {
      return rejectWithValue({
        error: err?.response?.data?.detail || "Could not fetch details.",
      });
    }
  }
);
`;
  await fs.writeFile(path.join(src, "external", "api.js"), apiJs);

  // tests bootstrap
  await fs.writeFile(path.join(src, "__tests__", "setup.js"), `// vitest/jest setup\n`);

  // Public config.json
  await fs.writeFile(path.join(appDir, "public", "config.json"), `{\n  "apiEndpoint": "http://localhost:8000"\n}\n`);

  // 5) SCSS structure
  const stylesDir = path.join(src, "styles");
  await fs.writeFile(path.join(stylesDir, "abstract", "_colors.scss"), `$primary: #2563eb;
$accent-blue: #4f46e5;
$ink-900: #0f172a;
$success: #10b981;
$warn: #f59e0b;
$danger: #ef4444;
`);

  await fs.writeFile(path.join(stylesDir, "abstract", "_variables.scss"), `$ff: "Poppins", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
$fs-10: 10px; $fs-11: 11px; $fs-12: 12px; $fs-13: 13px; $fs-14: 14px;
$sp-4: 4px; $sp-6: 6px; $sp-8: 8px; $sp-10: 10px; $sp-12: 12px; $sp-16: 16px;
$radius-6: 6px; $radius-8: 8px; $radius-10: 10px;
`);

  // Your mixins
  await fs.writeFile(path.join(stylesDir, "abstract", "_mixins.scss"), `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap');

@mixin app-text($fs, $color, $weight: 400) {
  font-family: 'Poppins';
  font-size: $fs;
  color: $color;
  font-weight: $weight;
  letter-spacing: 0.01em;
}

@mixin flex-center { display:flex; align-items:center; justify-content:center; }

@mixin transition-smooth { transition: all 0.2s ease-in-out; }

@mixin shadow-card { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); }

@mixin shadow-hover { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); }

@mixin layout-row-start() {
  display:flex; flex-direction:row; align-items:flex-start; justify-content:flex-start;
}

@mixin layout($flexdirection: row, $justifycontent: center, $alignitems: center) {
  display:flex; flex-direction:$flexdirection; align-items:$alignitems; justify-content:$justifycontent;
}

@mixin font-props($font-weight, $font-size, $font-color) {
  font-family: "Poppins"; font-weight:$font-weight; font-size:$font-size; color:$font-color;
}

@mixin mobile { @media (max-width: 480px) { @content; } }
@mixin tablet { @media (min-width: 481px) and (max-width: 768px) { @content; } }
@mixin desktop { @media (min-width: 769px) and (max-width: 1279px) { @content; } }
@mixin larger-desktop { @media (min-width: 1280px) { @content; } }
`);

  await fs.writeFile(path.join(stylesDir, "_main.scss"),
`@use "abstract/colors";
@use "abstract/variables";
@use "abstract/mixins";

:root { font-family: variables.$ff; color: colors.$ink-900; }
body { margin:0; background:#f8fafc; }

.container { padding: 16px; border: 1px solid rgba(0,0,0,.06); border-radius: 10px; background: #fff; }
.btn-change { @include mixins.app-text(14px, colors.$ink-900, 500); padding: 8px 12px; border:1px solid rgba(0,0,0,.12); border-radius:8px; background:#fff; cursor:pointer; @include mixins.transition-smooth; }
.btn-change:hover { @include mixins.shadow-hover; transform: translateY(-1px); }
`);

  // 6) Wire App.jsx, main.jsx
  const appJsx = `import "./styles/_main.scss";
import HomeLayout from "./HomeLayout.jsx";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { fetchConfig } from "./external/api";

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchConfig());
  }, [dispatch]);

  return (
    <div className="container">
      <HomeLayout />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: "14px",
            marginTop: 20,
            color: "#fff",
            fontFamily: "Poppins",
            letterSpacing: "0.7px",
          },
          success: { style: { background: "#098d6e" } },
          loading: { style: { background: "#162b42" } },
          error: { style: { background: "#ed5565" } },
        }}
      />
    </div>
  );
}
export default App;`;
  await fs.writeFile(path.join(src, "App.jsx"), appJsx);

  const mainJsxPath = path.join(src, "main.jsx");
  const mainJsx = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Provider } from "react-redux";
import { store } from "./redux/store";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
`;
  await fs.writeFile(mainJsxPath, mainJsx);

  // 7) Final tip
  console.log("\\n Scaffolded Redux, hooks, API, Toaster, and SCSS successfully.");
}
