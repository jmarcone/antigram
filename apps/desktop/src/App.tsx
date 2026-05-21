import { useReducer } from "react";
import "./App.css";
import { Welcome } from "./screens/Welcome";
import { Parsing } from "./screens/Parsing";
import { Gallery } from "./screens/Gallery";
import { Reclaiming } from "./screens/Reclaiming";
import { Done } from "./screens/Done";
import type { Phase } from "./state";
import { initialState, reduce, AppDispatchContext, AppStateContext } from "./state";

function App() {
  const [state, dispatch] = useReducer(reduce, initialState);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        <main className="min-h-screen w-full grid place-items-center px-6 py-10">
          <Screen phase={state.phase} />
        </main>
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

function Screen({ phase }: { phase: Phase }) {
  switch (phase) {
    case "welcome":
      return <Welcome />;
    case "parsing":
      return <Parsing />;
    case "gallery":
      return <Gallery />;
    case "reclaiming":
      return <Reclaiming />;
    case "done":
      return <Done />;
  }
}

export default App;
