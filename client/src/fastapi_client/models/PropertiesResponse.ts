/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CityAverages } from './CityAverages';
import type { Property } from './Property';
/**
 * Response for properties endpoint.
 */
export type PropertiesResponse = {
    city: string;
    properties: Array<Property>;
    city_averages: Record<string, CityAverages>;
};

