"use client";

import { useState, useEffect } from "react";

interface AnalyticsDashboardProps {
  projectId: string;
  deploymentStats: Array<{
    status: string;
    _count: number;
  }>;
  buildTimes: number[];
}

export function AnalyticsDashboard({ 
  projectId, 
  deploymentStats, 
  buildTimes 
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Build süreleri grafiği için veri hazırla
  const buildTimeData = buildTimes.map((time, index) => ({
    deployment: `#${buildTimes.length - index}`,
    time: time,
  }));

  // Status dağılımı için veri hazırla
  const statusData = deploymentStats.map(stat => ({
    name: getStatusLabel(stat.status),
    value: stat._count,
    color: getStatusColor(stat.status),
  }));

  return (
    <div className="space-y-8">
      {/* Zaman Aralığı Seçici */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Deployment Metrikleri</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange("7d")}
            className={`px-4 py-2 rounded-lg text-sm ${
              timeRange === "7d" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            7 Gün
          </button>
          <button
            onClick={() => setTimeRange("30d")}
            className={`px-4 py-2 rounded-lg text-sm ${
              timeRange === "30d" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            30 Gün
          </button>
          <button
            onClick={() => setTimeRange("90d")}
            className={`px-4 py-2 rounded-lg text-sm ${
              timeRange === "90d" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            90 Gün
          </button>
        </div>
      </div>

      {/* Build Süreleri Grafiği */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-medium mb-4">Build Süreleri</h3>
        <div className="space-y-3">
          {buildTimeData.map((data, index) => (
            <div key={index} className="flex items-center gap-4">
              <span className="text-sm text-gray-400 w-16">{data.deployment}</span>
              <div className="flex-1 bg-gray-800 rounded-full h-6 relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-blue-600 rounded-full"
                  style={{ width: `${(data.time / Math.max(...buildTimes)) * 100}%` }}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white">
                  {data.time.toFixed(1)}s
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Dağılımı */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-medium mb-4">Deployment Status Dağılımı</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statusData.map((data, index) => (
            <div key={index} className="text-center">
              <div 
                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-2"
                style={{ backgroundColor: `${data.color}20`, border: `2px solid ${data.color}` }}
              >
                <span className="text-2xl font-bold" style={{ color: data.color }}>
                  {data.value}
                </span>
              </div>
              <p className="text-sm text-gray-400">{data.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment Aktivitesi */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-medium mb-4">Deployment Aktivitesi</h3>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }).map((_, index) => {
            const activity = Math.random() * 10;
            const opacity = activity > 0 ? Math.min(activity / 10, 1) : 0.1;
            return (
              <div
                key={index}
                className="aspect-square rounded"
                style={{
                  backgroundColor: activity > 0 ? `rgba(59, 130, 246, ${opacity})` : "rgba(31, 41, 55, 1)",
                }}
                title={`${Math.floor(activity)} deployment`}
              />
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">Son 4 hafta</p>
      </div>
    </div>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Bekliyor",
    BUILDING: "Build Ediliyor",
    READY: "Hazır",
    FAILED: "Başarısız",
    CANCELLED: "İptal Edildi",
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "#f59e0b",
    BUILDING: "#3b82f6",
    READY: "#10b981",
    FAILED: "#ef4444",
    CANCELLED: "#6b7280",
  };
  return colors[status] || "#6b7280";
} 