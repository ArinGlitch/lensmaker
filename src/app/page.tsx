"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Item,
  SavedViewSummary,
  ViewResponse,
  ViewSpec,
} from "@/lib/viewspec";
import Renderer from "@/components/Renderer";
import IntentBar from "@/components/IntentBar";
import EmptyState from "@/components/EmptyState";
import AblationToggle from "@/components/AblationToggle";
import FixedDashboard from "@/components/FixedDashboard";
import SpecInspector from "@/components/SpecInspector";
import SavedViews from "@/components/SavedViews";
import FallbackNotice from "@/components/FallbackNotice";
import RefineBar from "@/components/RefineBar";
import ItemDrawer from "@/components/ItemDrawer";
import { ItemSelectionProvider } from "@/components/ItemSelection";

interface DataResponse {
  items: Item[];
}

export default function Home() {
  const qc = useQueryClient();
  const [generative, setGenerative] = useState(true);
  const [intent, setIntent] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [view, setView] = useState<ViewResponse | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  /** Previous view, so one bad adjustment is always recoverable. */
  const [previous, setPrevious] = useState<ViewResponse | null>(null);

  const dataQuery = useQuery<DataResponse>({
    queryKey: ["data"],
    queryFn: async () => {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error("Failed to load data");
      return res.json();
    },
  });

  const viewsQuery = useQuery<{ views: SavedViewSummary[] }>({
    queryKey: ["views"],
    queryFn: async () => {
      const res = await fetch("/api/views");
      if (!res.ok) throw new Error("Failed to load saved views");
      return res.json();
    },
  });

  const generate = useMutation<ViewResponse, Error, string>({
    mutationFn: async (nextIntent) => {
      const res = await fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: nextIntent }),
      });
      if (!res.ok) throw new Error("Failed to generate view");
      return res.json();
    },
    onSuccess: (data) => setView(data),
  });

  const refine = useMutation<ViewResponse, Error, string>({
    mutationFn: async (instruction) => {
      if (!view) throw new Error("nothing to adjust");
      const res = await fetch("/api/view/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, intent, spec: view.spec }),
      });
      if (!res.ok) throw new Error("Failed to adjust view");
      return res.json();
    },
    onSuccess: (data) => {
      setPrevious(view);
      setView(data);
    },
  });

  const saveView = useMutation<unknown, Error, { intent: string; spec: ViewSpec }>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save view");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["views"] }),
  });

  const deleteView = useMutation<unknown, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/views/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete view");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["views"] }),
  });

  const items = dataQuery.data?.items ?? [];
  const spec = view?.spec ?? null;

  function handleSubmit(nextIntent: string) {
    setIntent(nextIntent);
    setPrevious(null);
    generate.mutate(nextIntent);
  }

  function handleLoadSaved(id: string) {
    const found = viewsQuery.data?.views.find((v) => v.id === id);
    if (!found) return;
    setIntent(found.intent);
    setView({
      spec: found.spec,
      source: "cache",
      provider: "saved",
      latencyMs: 0,
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lensmaker</h1>
          <p className="mt-1 text-sm text-neutral-400">
            State what you care about. The model composes the screen.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AblationToggle
            enabled={generative}
            onChange={(v) => {
              setGenerative(v);
              // An open message belongs to the mode it was opened from, and it
              // sits in a reserved column. Closing it on a mode switch returns
              // the incoming screen to the centre.
              setSelected(null);
            }}
          />
          {view ? (
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              Inspect spec
            </button>
          ) : null}
        </div>
      </header>

      {generative ? (
        <>
          <IntentBar onSubmit={handleSubmit} isLoading={generate.isPending} />

          {generate.isPending ? (
            <p className="text-sm text-neutral-500">Composing a view…</p>
          ) : null}
          {refine.isPending ? (
            <p className="text-sm text-neutral-500">Adjusting the view…</p>
          ) : null}

          {spec?.insufficient_evidence ? (
            <EmptyState notes={spec.notes} intent={intent} />
          ) : spec ? (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-lg font-medium">{spec.title}</h2>
                  <p className="text-xs text-neutral-500">
                    {/* Provider, cache source and latency are deliberately NOT
                        shown here — naming the model on screen is a detail the
                        viewer does not need. They remain visible in the spec
                        inspector for anyone who wants to check the machinery. */}
                    {spec.intent_echo}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {previous ? (
                    <button
                      type="button"
                      onClick={() => {
                        setView(previous);
                        setPrevious(null);
                      }}
                      className="rounded border border-[var(--line-strong)] px-3 py-1.5 text-xs text-[var(--ink-2)] hover:bg-white/5"
                    >
                      Undo
                    </button>
                  ) : null}
                  <RefineBar
                    onRefine={(instruction) => refine.mutate(instruction)}
                    isLoading={refine.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => saveView.mutate({ intent, spec })}
                    className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
                  >
                    Save view
                  </button>
                </div>
              </div>
              {view?.source === "fallback" ? (
                <FallbackNotice
                  provider={view.provider}
                  failureKind={view.failureKind}
                />
              ) : null}

              <ItemSelectionProvider value={setSelected}>
                <Renderer spec={spec} items={items} />
              </ItemSelectionProvider>
            </section>
          ) : (
            <p className="text-sm text-neutral-500">
              Ask something to build a view.
            </p>
          )}
        </>
      ) : (
        <ItemSelectionProvider value={setSelected}>
          <FixedDashboard items={items} />
        </ItemSelectionProvider>
      )}

      <SavedViews
        views={viewsQuery.data?.views ?? []}
        onLoad={handleLoadSaved}
        onDelete={(id) => deleteView.mutate(id)}
      />

      <ItemDrawer item={selected} onClose={() => setSelected(null)} />

      <SpecInspector
        spec={view?.spec ?? null}
        meta={{
          provider: view?.provider ?? "—",
          latencyMs: view?.latencyMs ?? 0,
          source: view?.source ?? "—",
        }}
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
      />
    </main>
  );
}
