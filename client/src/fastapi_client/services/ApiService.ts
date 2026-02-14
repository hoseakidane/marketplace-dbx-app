/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AmenitiesResponse } from '../models/AmenitiesResponse';
import type { CitiesResponse } from '../models/CitiesResponse';
import type { CityFunnelResponse } from '../models/CityFunnelResponse';
import type { CityInvestmentResponse } from '../models/CityInvestmentResponse';
import type { DeviceMetricsResponse } from '../models/DeviceMetricsResponse';
import type { PropertiesResponse } from '../models/PropertiesResponse';
import type { PropertyTypesResponse } from '../models/PropertyTypesResponse';
import type { TopAmenitiesResponse } from '../models/TopAmenitiesResponse';
import type { UserInfo } from '../models/UserInfo';
import type { UserWorkspaceInfo } from '../models/UserWorkspaceInfo';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ApiService {
    /**
     * Get Current User
     * Get current user information from Databricks.
     * @returns UserInfo Successful Response
     * @throws ApiError
     */
    public static getCurrentUserApiUserMeGet(): CancelablePromise<UserInfo> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/user/me',
        });
    }
    /**
     * Get User Workspace Info
     * Get user information along with workspace details.
     * @returns UserWorkspaceInfo Successful Response
     * @throws ApiError
     */
    public static getUserWorkspaceInfoApiUserMeWorkspaceGet(): CancelablePromise<UserWorkspaceInfo> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/user/me/workspace',
        });
    }
    /**
     * Get Cities
     * Get list of all cities for dropdowns.
     * @returns CitiesResponse Successful Response
     * @throws ApiError
     */
    public static getCitiesApiAnalyticsCitiesGet(): CancelablePromise<CitiesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/analytics/cities',
        });
    }
    /**
     * Get City Investment
     * Get city investment matrix data for the overview tab.
     * @returns CityInvestmentResponse Successful Response
     * @throws ApiError
     */
    public static getCityInvestmentApiAnalyticsCityInvestmentGet(): CancelablePromise<CityInvestmentResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/analytics/city-investment',
        });
    }
    /**
     * Get City Funnel
     * Get conversion funnel data by city.
     * @param city Filter by city (or 'all')
     * @param days Number of days to look back
     * @returns CityFunnelResponse Successful Response
     * @throws ApiError
     */
    public static getCityFunnelApiAnalyticsCityFunnelGet(
        city?: (string | null),
        days: number = 90,
    ): CancelablePromise<CityFunnelResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/analytics/city-funnel',
            query: {
                'city': city,
                'days': days,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Properties
     * Get property performance data with city averages and bucket categorization.
     * @param city Filter by city (or 'all')
     * @returns PropertiesResponse Successful Response
     * @throws ApiError
     */
    public static getPropertiesApiAnalyticsPropertiesGet(
        city?: (string | null),
    ): CancelablePromise<PropertiesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/analytics/properties',
            query: {
                'city': city,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Amenities
     * Get amenity lift data.
     * @param city Filter by city (or 'all')
     * @param propertyType Filter by property type
     * @returns AmenitiesResponse Successful Response
     * @throws ApiError
     */
    public static getAmenitiesApiAnalyticsAmenitiesGet(
        city?: (string | null),
        propertyType?: (string | null),
    ): CancelablePromise<AmenitiesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/analytics/amenities',
            query: {
                'city': city,
                'property_type': propertyType,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Top Amenities By City
     * Get top 3 amenities for each city.
     * @returns TopAmenitiesResponse Successful Response
     * @throws ApiError
     */
    public static getTopAmenitiesByCityApiAnalyticsAmenitiesTopByCityGet(): CancelablePromise<TopAmenitiesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/analytics/amenities/top-by-city',
        });
    }
    /**
     * Get Device Metrics
     * Get device-segmented funnel and trends.
     * @param city Filter by city (or 'all')
     * @param weeks Number of weeks to look back
     * @returns DeviceMetricsResponse Successful Response
     * @throws ApiError
     */
    public static getDeviceMetricsApiAnalyticsDeviceMetricsGet(
        city?: (string | null),
        weeks: number = 6,
    ): CancelablePromise<DeviceMetricsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/analytics/device-metrics',
            query: {
                'city': city,
                'weeks': weeks,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Property Types
     * Get list of distinct property types.
     * @returns PropertyTypesResponse Successful Response
     * @throws ApiError
     */
    public static getPropertyTypesApiAnalyticsPropertyTypesGet(): CancelablePromise<PropertyTypesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/analytics/property-types',
        });
    }
}
