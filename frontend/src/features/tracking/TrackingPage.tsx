import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { Clock, LocateFixed, Search } from "lucide-react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { getRoutePlayback, getTracking } from "../../lib/api";

const tileUrl =
  import.meta.env.VITE_MAP_TILE_URL ??
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const statusTone: Record<string, string> = {
  available: "#0f8f63",
  in_route: "#027f9f",
  stopped: "#b7791f",
  maintenance: "#c2413b",
  inactive: "#71717a",
  blocked: "#161816",
};

function markerIcon(status: string) {
  const color = statusTone[status] ?? "#71717a";
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:8px;background:${color};border:3px solid white;box-shadow:0 10px 20px rgba(0,0,0,.25)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function TrackingPage() {
  const [playbackVehicleId, setPlaybackVehicleId] = useState<string>();
  const {
    data = {
      vehicles: [],
      geofences: [],
      refreshedAt: new Date().toISOString(),
    },
  } = useQuery({
    queryKey: ["tracking-live"],
    queryFn: () => getTracking(),
    refetchInterval: 15_000,
  });
  const { data: playback = [], isFetching: isPlaybackLoading } = useQuery({
    queryKey: ["route-playback", playbackVehicleId],
    queryFn: () =>
      playbackVehicleId
        ? getRoutePlayback(playbackVehicleId)
        : Promise.resolve([]),
    enabled: Boolean(playbackVehicleId),
  });

  const vehiclesWithPosition = data.vehicles.filter(
    (vehicle) => vehicle.lastPosition?.coordinates,
  );
  const firstVehicle = vehiclesWithPosition[0];
  const center = firstVehicle?.lastPosition?.coordinates
    ? ([
        firstVehicle.lastPosition.coordinates[1],
        firstVehicle.lastPosition.coordinates[0],
      ] as [number, number])
    : ([-23.5505, -46.6333] as [number, number]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Rastreamento em tempo real</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Posicoes, status ao vivo, geocercas e playback de rotas.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            const vehicleId = playbackVehicleId ?? vehiclesWithPosition[0]?._id;
            if (vehicleId) {
              setPlaybackVehicleId(vehicleId);
            }
          }}
        >
          <Clock size={18} />
          {isPlaybackLoading ? "Carregando..." : "Playback de rota"}
        </Button>
      </section>

      <section className="grid min-h-[720px] gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Veiculos online</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Atualizado em{" "}
                {new Date(data.refreshedAt).toLocaleTimeString("pt-BR")}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-2.5 text-zinc-400"
                size={18}
              />
              <Input className="pl-10" placeholder="Buscar placa ou modelo" />
            </div>
            <div className="space-y-3">
              {data.vehicles.map((vehicle) => (
                <button
                  type="button"
                  key={vehicle._id}
                  className="w-full rounded-lg border border-fleet-line p-4 text-left transition hover:border-fleet-green"
                  onClick={() => setPlaybackVehicleId(vehicle._id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong>{vehicle.plate}</strong>
                      <p className="text-sm text-zinc-500">
                        {vehicle.brand} {vehicle.model}
                      </p>
                    </div>
                    <Badge
                      tone={
                        vehicle.status === "maintenance"
                          ? "red"
                          : vehicle.status === "in_route"
                            ? "cyan"
                            : "green"
                      }
                    >
                      {vehicle.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <span className="rounded-md bg-zinc-50 p-2">
                      Velocidade:{" "}
                      {String(vehicle.telemetrySummary?.speedKph ?? 0)} km/h
                    </span>
                    <span className="rounded-md bg-zinc-50 p-2">
                      Comb.: {String(vehicle.telemetrySummary?.fuelLevel ?? 0)}%
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    {vehicle.lastPosition?.address ?? "Sem posicao"}
                  </p>
                </button>
              ))}
            </div>
            {playbackVehicleId && (
              <div className="rounded-lg border border-fleet-line bg-zinc-50 p-3 text-sm text-zinc-600">
                Playback selecionado:{" "}
                {data.vehicles.find(
                  (vehicle) => vehicle._id === playbackVehicleId,
                )?.plate ?? playbackVehicleId}
                .
                {playback.length > 0
                  ? ` ${playback.length} pontos carregados.`
                  : " Carregando pontos de rota."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="h-[720px] w-full">
            <MapContainer
              center={center}
              zoom={12}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url={tileUrl}
              />
              {data.geofences.map((geofence) =>
                geofence.center?.coordinates && geofence.radiusMeters ? (
                  <Circle
                    key={geofence._id}
                    center={[
                      geofence.center.coordinates[1],
                      geofence.center.coordinates[0],
                    ]}
                    radius={geofence.radiusMeters}
                    pathOptions={{
                      color: "#0f8f63",
                      fillColor: "#0f8f63",
                      fillOpacity: 0.08,
                      weight: 2,
                    }}
                  />
                ) : null,
              )}
              {vehiclesWithPosition.map((vehicle) => {
                const coordinates = vehicle.lastPosition?.coordinates;
                if (!coordinates) {
                  return null;
                }
                return (
                  <Marker
                    key={vehicle._id}
                    position={[coordinates[1], coordinates[0]]}
                    icon={markerIcon(vehicle.status)}
                  >
                    <Popup>
                      <div className="min-w-48">
                        <strong>{vehicle.plate}</strong>
                        <p>
                          {vehicle.brand} {vehicle.model}
                        </p>
                        <p>Status: {vehicle.status}</p>
                        <p>
                          Velocidade:{" "}
                          {String(vehicle.telemetrySummary?.speedKph ?? 0)} km/h
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              {playback.length > 1 && (
                <Polyline
                  positions={playback.map((point) => [
                    point.location.coordinates[1],
                    point.location.coordinates[0],
                  ])}
                  pathOptions={{ color: "#027f9f", weight: 4 }}
                />
              )}
              <div className="leaflet-bottom leaflet-left">
                <div className="leaflet-control rounded-md border border-fleet-line bg-white p-3 text-sm shadow-soft">
                  <span className="flex items-center gap-2">
                    <LocateFixed size={16} className="text-fleet-green" />
                    {vehiclesWithPosition.length} veiculos com posicao
                  </span>
                </div>
              </div>
            </MapContainer>
          </div>
        </Card>
      </section>
    </div>
  );
}
