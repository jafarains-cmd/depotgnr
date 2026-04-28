"use client";

import { useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

export function MapPickerGoogle({
  apiKey,
  lat,
  lng,
  onPick,
  onFail,
}: {
  apiKey: string;
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  onFail: () => void;
}) {
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    lat !== null && lng !== null ? { lat, lng } : null,
  );
  const center = marker ?? { lat: -6.2, lng: 106.816 };

  return (
    <APIProvider apiKey={apiKey} onError={onFail}>
      <Map
        defaultCenter={center}
        defaultZoom={marker ? 16 : 11}
        mapId="depot-air-picker"
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: "100%", height: "100%" }}
      >
        <ClickHandler
          onClick={(la, ln) => {
            setMarker({ lat: la, lng: ln });
            onPick(la, ln);
          }}
        />
        {marker && (
          <AdvancedMarker position={marker}>
            <Pin background="#0284c7" borderColor="#fff" glyphColor="#fff" />
          </AdvancedMarker>
        )}
      </Map>
    </APIProvider>
  );
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onClick(e.latLng.lat(), e.latLng.lng());
    });
    return () => listener.remove();
  }, [map, onClick]);
  return null;
}
