"use client";
import Head from "next/head";
import Script from "next/script";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ChartAreaSingle } from "@/components/ui/chart-area";
import { ChartBarMixedSimple } from "@/components/ui/char-bar-mixed";
import { type ChartConfig } from "@/components/ui/chart";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
} from "@/components/ui/table";

export default function Home() {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [fromTime, setFromTime] = useState("");
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [toTime, setToTime] = useState("");
  const [fromLabel, setFromLabel] = useState("Entrada");
  const [toLabel, setToLabel] = useState("Saída");

  const [detectionsTimeData, setDetectionsTimeData] = useState<{ time: string; detections: number }[]>([]);

  function combine(dateObj: Date | undefined, timeStr: string) {
    if (!dateObj) return "";
    const t = timeStr && timeStr.length ? timeStr : "00:00";
    const dateStr = format(dateObj, "yyyy-MM-dd");
    return `${dateStr}T${t}`;
  }
  function displayLabel(prefix: string, dateObj: Date | undefined, timeStr: string) {
    if (!dateObj) return prefix;
    const t = timeStr && timeStr.length ? timeStr : "00:00";
    const d = format(dateObj, "dd/MM/yyyy");
    return `${prefix}: ${d} ${t}`;
  }

  useEffect(() => {
    // Carregar script externo de app.js depois que a página renderizar
    const script = document.createElement("script");
    script.src = "/app.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail || {};
      const labels: string[] = Array.isArray(detail.labels) ? detail.labels : [];
      const data: number[] = Array.isArray(detail.data) ? detail.data : [];
      const combined = labels.map((label, i) => ({ time: label, detections: Number(data[i] ?? 0) }));
      setDetectionsTimeData(combined);
    };
    window.addEventListener("detectionsTimeUpdate", handler as EventListener);
    return () => window.removeEventListener("detectionsTimeUpdate", handler as EventListener);
  }, []);

  useEffect(() => {
    const clearBtn = document.getElementById("clear-filters-btn");
    if (!clearBtn) return;
    const handler = () => {
      setFromDate(undefined);
      setFromTime("");
      setToDate(undefined);
      setToTime("");
      setFromLabel("Entrada");
      setToLabel("Saída");
    };
    clearBtn.addEventListener("click", handler);
    return () => clearBtn.removeEventListener("click", handler);
  }, []);

  const [actionsBarData, setActionsBarData] = useState<Array<{ category: string; value: number; fill?: string }>>([])
  const [objectsBarData, setObjectsBarData] = useState<Array<{ category: string; value: number; fill?: string }>>([])

  // Configurações de cor/label para os gráficos de barras
  const actionsConfig = {
    value: { label: "Total" },
    walking: { label: "Andando", color: "#e11d48" },
    standing: { label: "Sentado", color: "#06b6d4" },
  } satisfies ChartConfig

  const objectsConfig = {
    value: { label: "Total" },
    holding: { label: "Segurando", color: "#f59e0b" },
    notHolding: { label: "Mãos livres", color: "#22c55e" },
  } satisfies ChartConfig

  useEffect(() => {
    const actionsHandler = (e: any) => {
      const det = e.detail as { walking: number; standing: number }
      setActionsBarData([
        { category: "walking", value: det.walking, fill: "var(--color-walking)" },
        { category: "standing", value: det.standing, fill: "var(--color-standing)" },
      ])
    }
    const objectsHandler = (e: any) => {
      const det = e.detail as { holding: number; notHolding: number }
      setObjectsBarData([
        { category: "holding", value: det.holding, fill: "var(--color-holding)" },
        { category: "notHolding", value: det.notHolding, fill: "var(--color-notHolding)" },
      ])
    }
    window.addEventListener("actionsBarUpdate", actionsHandler as any)
    window.addEventListener("objectsBarUpdate", objectsHandler as any)
    return () => {
      window.removeEventListener("actionsBarUpdate", actionsHandler as any)
      window.removeEventListener("objectsBarUpdate", objectsHandler as any)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#101419] text-gray-100">
      <Head>
        <title>Person Detection App</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Chart.js */}
      <Script
        src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
        strategy="beforeInteractive"
      />

      <div className="container mx-auto px-4 py-8">
        {/* HEADER */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-100">
            Sistema para detecção de pessoas em tempo real
          </h1>
          <p className="text-gray-300">
            Utilizando visão computacional com YOLO
          </p>
        </header>

        {/* GRID: CAMERA + CHAT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Camera Feed Section */}
          <Card>
            <CardHeader>
              <CardTitle>Detecção em Tempo Real</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full max-w-lg mx-auto">
                <img
                  id="video-feed"
                  src="/placeholder.jpg"
                  alt="Camera feed"
                  className="w-full rounded-lg"
                />
              </div>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Status da Detecção</h3>
                <div id="detection-stats" className="text-sm text-gray-300">
                  <p>
                    Pessoas detectadas: <span id="people-count">0</span>
                  </p>
                  <p>
                    Tempo de rastreamento: <span id="time-tracking">00:00</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chat Section */}
          <Card>
            <CardHeader>
              <CardTitle>Assistente Virtual</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                id="chat-messages"
                className="h-72 overflow-y-auto bg-[#3b3f49] p-4 rounded-lg mb-4"
              >
                <div className="mb-3">
                  <div className="font-medium text-gray-100">Assistente Virtual</div>
                  <div className="bg-[#1F2229] p-3 rounded-lg inline-block mt-2">
                    Olá! Posso responder a perguntas sobre as pessoas detectadas
                    no vídeo. Tente me perguntar algo como{" "}
                    <strong>"Quantas pessoas foram detectadas?"</strong> ou{" "}
                    <strong>"Quando a primeira pessoa apareceu?"</strong>.
                  </div>
                </div>
              </div>
              <div className="flex">
                <Input
                  id="chat-input"
                  placeholder="Fale comigo..."
                  className="rounded-l-lg bg-[#3b3f49] text-white"
                />
                <Button id="send-btn" className="bg-[#5c616b] text-white hover:bg-secondary active:bg-hover rounded-lg px-4 py-2 m-1">
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Overview cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { title: "Total de pessoas encontradas", id: "total-tracked" },
                { title: "Pessoas ativas no frame", id: "active-in-frame" },
                { title: "Objeto segurado", id: "holding-objects-count" },
                { title: "Média de tempo no frame (s)", id: "avg-time-spent" },
              ].map((card) => (
                <div key={card.id} className="bg-[#3B3F49] p-4 rounded-lg">
                  <h3 className="font-medium mb-1">{card.title}</h3>
                  <p className="text-3xl font-bold" id={card.id}>
                    0
                  </p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Shadcn: Ações (Bar Mixed) */}
              <div className="bg-[#3B3F49] p-4 rounded-lg" style={{ height: 280 }}>
                <h3 className="font-medium mb-2">Ações</h3>
                <ChartBarMixedSimple
                  data={actionsBarData}
                  categoryKey="category"
                  valueKey="value"
                  config={actionsConfig}
                  className="h-full w-full"
                />
              </div>

              {/* Shadcn: Objetos (Bar Mixed) */}
              <div className="bg-[#3B3F49] p-4 rounded-lg" style={{ height: 280 }}>
                <h3 className="font-medium mb-2">Objetos</h3>
                <ChartBarMixedSimple
                  data={objectsBarData}
                  categoryKey="category"
                  valueKey="value"
                  config={objectsConfig}
                  className="h-full w-full"
                />
              </div>

              {/* Shadcn Chart: Detecções ao longo do tempo (Área, série única) */}
              <div className="bg-[#3B3F49] p-4 rounded-lg" style={{ height: 280 }}>
                <h3 className="font-medium mb-2">Detecções ao Longo do Tempo</h3>
                <div id="detectionsTimeChart" style={{ width: "100%", height: "100%" }}>
                  <ChartAreaSingle
                    data={detectionsTimeData}
                    xKey="time"
                    yKey="detections"
                    label="Detections"
                    color="hsl(0, 84%, 60%)"
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-3 text-gray-100">
                Consultar e Filtrar
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Input
                  id="filter-color"
                  placeholder="Cor (ex: vermelho)"
                  className="bg-[#3b3f49]"
                />
                <select
                  id="filter-action"
                  className="px-3 py-2 rounded bg-[#3b3f49] border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Qualquer Ação</option>
                  <option value="walking">Andando</option>
                  <option value="standing">Sentado</option>
                </select>
                <select
                  id="filter-holding"
                  className="px-3 py-2 rounded bg-[#3b3f49] border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Qualquer Objeto</option>
                  <option value="true">Segurando Objeto</option>
                  <option value="false">Não Segurando</option>
                </select>

                {/* Entrada (Popover + Data/Hora) */}
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full bg-[#3b3f49] border border-gray-700 text-gray-100 hover:bg-gray-800"
                    >
                      {fromLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <label className="block text-sm text-gray-300 mb-1">Data</label>
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={setFromDate}
                      captionLayout="label"
                    />
                    <label className="block text-sm text-gray-300 mt-2 mb-1">Hora</label>
                    <Input
                      type="time"
                      value={fromTime}
                      onChange={(e) => setFromTime(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="secondary" onClick={() => setFromOpen(false)}>Cancelar</Button>
                      <Button
                        onClick={() => {
                          const val = combine(fromDate, fromTime);
                          const hidden = document.getElementById('filter-from') as HTMLInputElement | null;
                          if (hidden) hidden.value = val;
                          setFromLabel(displayLabel('Entrada', fromDate, fromTime));
                          setFromOpen(false);
                          const applyBtn = document.getElementById('apply-filters-btn') as HTMLButtonElement | null;
                          if (applyBtn) applyBtn.click();
                        }}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Saída (Popover + Data/Hora) */}
                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full bg-[#3b3f49] border border-gray-700 text-gray-100 hover:bg-gray-800"
                    >
                      {toLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <label className="block text-sm text-gray-300 mb-1">Data</label>
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={setToDate}
                      captionLayout="label"
                    />
                    <label className="block text-sm text-gray-300 mt-2 mb-1">Hora</label>
                    <Input
                      type="time"
                      value={toTime}
                      onChange={(e) => setToTime(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="secondary" onClick={() => setToOpen(false)}>Cancelar</Button>
                      <Button
                        onClick={() => {
                          const val = combine(toDate, toTime);
                          const hidden = document.getElementById('filter-to') as HTMLInputElement | null;
                          if (hidden) hidden.value = val;
                          setToLabel(displayLabel('Saída', toDate, toTime));
                          setToOpen(false);
                          const applyBtn = document.getElementById('apply-filters-btn') as HTMLButtonElement | null;
                          if (applyBtn) applyBtn.click();
                        }}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Hidden inputs consumidos por app.js */}
                <input id="filter-from" type="hidden" />
                <input id="filter-to" type="hidden" />
              </div>

              <div className="mt-4 flex gap-3">
                <Button id="apply-filters-btn" className="bg-[#5c616b]">Aplicar Filtros</Button>
                <Button id="clear-filters-btn" variant="secondary">
                  Clear
                </Button>
              </div>

              {/* Results table */}
              <div className="mt-4 overflow-x-auto">
                <Table className="bg-[#3b3f49]">
                  <THead className="bg-[#2B323B]">
                    <TR>
                      <TH>ID</TH>
                      <TH>Entrada</TH>
                      <TH>Saída</TH>
                      <TH>Cor</TH>
                      <TH>Ação</TH>
                      <TH>Segurando</TH>
                      <TH>Objeto</TH>
                    </TR>
                  </THead>
                  <TBody id="persons-tbody"></TBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
