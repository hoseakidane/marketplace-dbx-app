/**
 * React Query hooks for analytics API
 */

import { useQuery } from "@tanstack/react-query";
import { AnalyticsService } from "@/fastapi_client";
import type { CityInvestment } from "@/fastapi_client/models/CityInvestment";
import type { Property } from "@/fastapi_client/models/Property";
import type { Amenity } from "@/fastapi_client/models/Amenity";
import type { TopAmenityCity } from "@/fastapi_client/models/TopAmenityCity";
// DeviceMetricsResponse type used for hook return typing

// ============================================================================
// Cities
// ============================================================================

export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const response = await AnalyticsService.getCitiesApiAnalyticsCitiesGet();
      return response.cities as string[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour - cities rarely change
  });
}

// ============================================================================
// City Investment (Overview Tab)
// ============================================================================

export function useCityInvestment() {
  return useQuery({
    queryKey: ["city-investment"],
    queryFn: async () => {
      const response =
        await AnalyticsService.getCityInvestmentApiAnalyticsCityInvestmentGet();
      return response.data as CityInvestment[];
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}

// ============================================================================
// City Funnel (Overview Tab)
// ============================================================================

interface FunnelData {
  viewers: number;
  bookers: number;
  completed: number;
}

interface CityFunnelResult {
  city: string;
  days: number;
  funnel: FunnelData;
}

export function useCityFunnel(city: string | null, days: number = 90) {
  return useQuery({
    queryKey: ["city-funnel", city, days],
    queryFn: async () => {
      const response =
        await AnalyticsService.getCityFunnelApiAnalyticsCityFunnelGet(
          city || undefined,
          days
        );
      return response as CityFunnelResult;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================================================
// Properties (Property Tab)
// ============================================================================

export interface PropertyData {
  id: string;
  name: string;
  city: string;
  propertyType: string | null;
  views: number;
  bookings: number;
  initiationRate: number;  // booked %
  completionRate: number;
  cancelRate: number;
  paymentFailRate: number;
  avgReviewRating: number | null;
  revenue: number;
  bucket: "promote" | "intervention" | "at_risk";
}

export interface CityAveragesData {
  avgViews: number;
  avgInitiationRate: number;
  propertyCount: number;
}

export interface PropertiesResult {
  properties: PropertyData[];
  cityAverages: Record<string, CityAveragesData>;
}

export function useProperties(city: string | null) {
  return useQuery({
    queryKey: ["properties", city],
    queryFn: async () => {
      const response =
        await AnalyticsService.getPropertiesApiAnalyticsPropertiesGet(
          city || undefined
        );
      // Map API response to frontend format
      const properties = response.properties.map(
        (p: Property): PropertyData => ({
          id: p.id,
          name: p.name,
          city: p.city,
          propertyType: p.property_type,
          views: p.views,
          bookings: p.bookings,
          initiationRate: p.initiation_rate,
          completionRate: p.completion_rate,
          cancelRate: p.cancel_rate,
          paymentFailRate: p.payment_fail_rate,
          avgReviewRating: p.avg_review_rating,
          revenue: p.revenue,
          bucket: p.bucket as "promote" | "intervention" | "at_risk",
        })
      );

      // Map city averages
      const cityAverages: Record<string, CityAveragesData> = {};
      for (const [c, avg] of Object.entries(response.city_averages || {})) {
        cityAverages[c] = {
          avgViews: avg.avg_views,
          avgInitiationRate: avg.avg_initiation_rate,
          propertyCount: avg.property_count,
        };
      }

      return { properties, cityAverages } as PropertiesResult;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================================================
// Property Types
// ============================================================================

export function usePropertyTypes() {
  return useQuery({
    queryKey: ["property-types"],
    queryFn: async () => {
      const response =
        await AnalyticsService.getPropertyTypesApiAnalyticsPropertyTypesGet();
      return response.property_types as string[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// ============================================================================
// Amenities (Amenity Tab)
// ============================================================================

export interface AmenityData {
  name: string;
  lift: number;
  impactTier: string | null;
}

export function useAmenities(
  city: string | null,
  propertyType: string | null
) {
  return useQuery({
    queryKey: ["amenities", city, propertyType],
    queryFn: async () => {
      const response =
        await AnalyticsService.getAmenitiesApiAnalyticsAmenitiesGet(
          city || undefined,
          propertyType || undefined
        );
      return response.amenities.map(
        (a: Amenity): AmenityData => ({
          name: a.name,
          lift: a.lift,
          impactTier: a.impact_tier,
        })
      );
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================================================
// Top Amenities by City (Amenity Tab)
// ============================================================================

export interface TopAmenityByCityData {
  city: string;
  propertyType: string;
  amenityName: string;
  lift: number;
  rank: number;
}

export function useTopAmenitiesByCity() {
  return useQuery({
    queryKey: ["top-amenities-by-city"],
    queryFn: async () => {
      const response =
        await AnalyticsService.getTopAmenitiesByCityApiAnalyticsAmenitiesTopByCityGet();
      return response.data.map(
        (a: TopAmenityCity): TopAmenityByCityData => ({
          city: a.city,
          propertyType: a.property_type,
          amenityName: a.amenity_name,
          lift: a.lift,
          rank: a.rank,
        })
      );
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}

// ============================================================================
// Device Metrics (Demand Tab)
// ============================================================================

export interface DeviceFunnelData {
  viewers: number;
  bookers: number;
  completed: number;
}

export interface WeeklyTrendData {
  week: string;
  desktop: number | null;
  mobile: number | null;
  tablet: number | null;
}

export interface DeviceDiagnosisData {
  desktopRate: number;
  mobileRate: number;
  tabletRate: number;
  deviceGap: number;
  diagnosis: string;
  mobileTrend: string;
}

export interface DeviceMetricsData {
  city: string;
  deviceFunnel: Record<string, DeviceFunnelData>;
  weeklyTrends: WeeklyTrendData[];
  diagnosis: DeviceDiagnosisData;
}

export function useDeviceMetrics(city: string | null, weeks: number = 6) {
  return useQuery({
    queryKey: ["device-metrics", city, weeks],
    queryFn: async () => {
      const response =
        await AnalyticsService.getDeviceMetricsApiAnalyticsDeviceMetricsGet(
          city || undefined,
          weeks
        );
      return response as DeviceMetricsData;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
