import React, { useMemo, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export type LeafletPin = {
  id: string;
  lat: number;
  lng: number;
  color?: string;       // hex, default green
  label?: string;
  title?: string;
};

export type LeafletProps = {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  pins?: LeafletPin[];
  showUser?: boolean;
  userLat?: number;
  userLng?: number;
  satellite?: boolean;
  draggablePin?: boolean;          // when true, single pin user can drag
  draggableInitialLat?: number;
  draggableInitialLng?: number;
  onPinDrag?: (lat: number, lng: number) => void;
  onPinTap?: (id: string) => void;
  style?: any;
};

function buildHtml(props: LeafletProps) {
  const {
    centerLat, centerLng, zoom = 16,
    pins = [], showUser, userLat, userLng,
    satellite = false,
    draggablePin = false, draggableInitialLat, draggableInitialLng,
  } = props;
  const safePins = JSON.stringify(pins);
  const dragLat = draggableInitialLat ?? centerLat;
  const dragLng = draggableInitialLng ?? centerLng;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background:#E7EFE7; }
  .efyl-pin {
    width: 22px; height: 22px; border-radius: 11px;
    border: 3px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  .efyl-user {
    width: 18px; height: 18px; border-radius: 9px;
    background:#3B82F6; border: 3px solid #fff;
    box-shadow: 0 0 0 8px rgba(59,130,246,0.25);
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse {
    0%{ box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
    100%{ box-shadow: 0 0 0 16px rgba(59,130,246,0); }
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function send(msg){ try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e){} }
  var map = L.map('map',{ zoomControl:true, attributionControl:false }).setView([${centerLat}, ${centerLng}], ${zoom});
  var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19 });
  var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{ maxZoom:19 });
  ${satellite ? 'sat' : 'osm'}.addTo(map);

  function makeIcon(color){
    return L.divIcon({ className:'', html:'<div class="efyl-pin" style="background:'+color+'"></div>', iconSize:[22,22], iconAnchor:[11,11] });
  }

  var pins = ${safePins};
  pins.forEach(function(p){
    var marker = L.marker([p.lat, p.lng], { icon: makeIcon(p.color || '#22C55E') }).addTo(map);
    if (p.title) marker.bindPopup(p.title);
    marker.on('click', function(){ send({ type:'pin', id:p.id }); });
  });

  ${showUser && typeof userLat === 'number' && typeof userLng === 'number'
    ? `L.marker([${userLat}, ${userLng}], { icon: L.divIcon({ className:'', html:'<div class="efyl-user"></div>', iconSize:[18,18], iconAnchor:[9,9] }) }).addTo(map);`
    : ''}

  ${draggablePin ? `
    var d = L.marker([${dragLat}, ${dragLng}], { draggable:true, icon: makeIcon('#E8851A') }).addTo(map);
    d.on('dragend', function(e){
      var ll = d.getLatLng();
      send({ type:'drag', lat: ll.lat, lng: ll.lng });
    });
  ` : ''}

  // Web-only: provide a global so RN can call into us
  window._efylSetCenter = function(lat, lng, zoom){
    map.setView([lat,lng], zoom || ${zoom});
  };
</script>
</body>
</html>`;
}

export const LeafletMap: React.FC<LeafletProps> = (props) => {
  const html = useMemo(() => buildHtml(props), [
    props.centerLat, props.centerLng, props.zoom,
    JSON.stringify(props.pins || []),
    props.showUser, props.userLat, props.userLng,
    props.satellite, props.draggablePin,
    props.draggableInitialLat, props.draggableInitialLng,
  ]);

  const ref = useRef<any>(null);

  const onMessage = (ev: any) => {
    try {
      const data = JSON.parse(ev.nativeEvent.data);
      if (data.type === 'pin' && props.onPinTap) props.onPinTap(data.id);
      if (data.type === 'drag' && props.onPinDrag) props.onPinDrag(data.lat, data.lng);
    } catch { /* ignore */ }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, props.style]}>
        <iframe
          ref={(el) => { ref.current = el; }}
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 0 }}
          title="leaflet-map"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, props.style]}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        style={styles.wv}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E7EFE7', overflow: 'hidden' },
  wv: { flex: 1, backgroundColor: 'transparent' },
});
