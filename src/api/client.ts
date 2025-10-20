// src/api/client.ts
import { treaty } from "@elysiajs/eden";
import { Effect, Data } from "effect";
import type { App } from "../server";
import type {
  SerializablePattern,
  SerializableChord,
  SerializableTuning,
} from "../../types/app";

// --- EDEN & ERROR SETUP ---
export class ApiError extends Data.TaggedError("ApiError")<{
  readonly message: string;
  readonly cause?: unknown;
}> { }

export const client = treaty<App>("http://localhost:8080");

// --- Effect-based API Call Descriptions ---
export const fetchInitialDataEffect = Effect.all([
  Effect.promise(() => client.patterns.get()),
  Effect.promise(() => client.chords.get()),
  Effect.promise(() => client.tunings.get()),
]).pipe(
  Effect.flatMap(([patternsResponse, chordsResponse, tuningsResponse]) => {
    if (
      patternsResponse.data &&
      Array.isArray(patternsResponse.data) &&
      chordsResponse.data &&
      Array.isArray(chordsResponse.data) &&
      tuningsResponse.data &&
      Array.isArray(tuningsResponse.data)
    ) {
      return Effect.succeed({
        patterns: patternsResponse.data,
        chords: chordsResponse.data,
        tunings: tuningsResponse.data,
      });
    }
    // Aggregate potential errors
    if (patternsResponse.error) {
      return Effect.fail(
        new ApiError({
          message: "API error fetching patterns",
          cause: patternsResponse.error,
        }),
      );
    }
    if (chordsResponse.error) {
      return Effect.fail(
        new ApiError({
          message: "API error fetching chords",
          cause: chordsResponse.error,
        }),
      );
    }
    if (tuningsResponse.error) {
      return Effect.fail(
        new ApiError({
          message: "API error fetching tunings",
          cause: tuningsResponse.error,
        }),
      );
    }
    return Effect.fail(
      new ApiError({
        message: "An unknown API error occurred during initial data fetch.",
      }),
    );
  }),
);

export const createPatternEffect = (input: {
  name: string;
  notes: string;
  key_root: string;
  key_type: string;
  chord_palette: string;
  melody: string; // NEW
}) =>
  Effect.promise(() => client.patterns.post(input)).pipe(
    Effect.flatMap((response) => {
      if (response && response.error) {
        return Effect.fail(
          new ApiError({
            message:
              (response.error.value as any)?.error ??
              "API error creating pattern",
            cause: response.error,
          }),
        );
      }
      return Effect.succeed(response.data as SerializablePattern);
    }),
  );

export const updatePatternEffect = (input: {
  id: string;
  name: string;
  content: string;
  key_root: string;
  key_type: string;
  chord_palette: string;
  melody: string; // NEW
}) => {
  const { id, name, content, key_root, key_type, chord_palette, melody } =
    input;
  return Effect.promise(() =>
    client.patterns({ id }).put({
      name,
      notes: content,
      key_root,
      key_type,
      chord_palette,
      melody, // NEW
    }),
  ).pipe(
    Effect.flatMap((response) => {
      if (response && response.error) {
        return Effect.fail(
          new ApiError({
            message:
              (response.error.value as any)?.error ??
              "API error updating pattern",
            cause: response.error,
          }),
        );
      }
      return Effect.succeed(undefined as void);
    }),
  );
};

export const deletePatternEffect = (input: { id: string }) =>
  Effect.promise(() => client.patterns({ id: input.id }).delete()).pipe(
    Effect.flatMap((response) => {
      if (response && response.error) {
        return Effect.fail(
          new ApiError({
            message:
              (response.error.value as any)?.error ??
              "API error deleting pattern",
            cause: response.error,
          }),
        );
      }
      return Effect.succeed(undefined as void);
    }),
  );

export const createChordEffect = (input: {
  name: string;
  tab: string;
  tuning: string;
}) =>
  Effect.promise(() => client.chords.post(input)).pipe(
    Effect.flatMap((response) => {
      if (response && response.error) {
        return Effect.fail(
          new ApiError({
            message:
              (response.error.value as any)?.error ?? "API error creating chord",
            cause: response.error,
          }),
        );
      }
      return Effect.succeed(response.data as SerializableChord);
    }),
  );

export const updateChordEffect = (input: {
  id: string;
  name: string;
  tab: string;
  tuning: string;
}) =>
  Effect.promise(() => client.chords({ id: input.id }).put(input)).pipe(
    Effect.flatMap((response) => {
      if (response && response.error) {
        return Effect.fail(
          new ApiError({
            message:
              (response.error.value as any)?.error ?? "API error updating chord",
            cause: response.error,
          }),
        );
      }
      return Effect.succeed(undefined as void);
    }),
  );

export const deleteChordEffect = (input: { id: string }) =>
  Effect.promise(() => client.chords({ id: input.id }).delete()).pipe(
    Effect.flatMap((response) => {
      if (response && response.error) {
        return Effect.fail(
          new ApiError({
            message:
              (response.error.value as any)?.error ?? "API error deleting chord",
            cause: response.error,
          }),
        );
      }
      return Effect.succeed(undefined as void);
    }),
  );

export const createTuningEffect = (input: { name: string; notes: string }) =>
  Effect.promise(() => client.tunings.post(input)).pipe(
    Effect.flatMap((response) => {
      if (response && response.error) {
        return Effect.fail(
          new ApiError({
            message:
              (response.error.value as any)?.error ??
              "API error creating tuning",
            cause: response.error,
          }),
        );
      }
      return Effect.succeed(response.data as SerializableTuning);
    }),
  );

export const updateTuningEffect = (input: {
  id: string;
  name: string;
  notes: string;
}) =>
  Effect.promise(() => client.tunings({ id: input.id }).put(input)).pipe(
    Effect.flatMap((response) => {
      if (response && response.error) {
        return Effect.fail(
          new ApiError({
            message:
              (response.error.value as any)?.error ??
              "API error updating tuning",
            cause: response.error,
          }),
        );
      }
      return Effect.succeed(undefined as void);
    }),
  );

export const deleteTuningEffect = (input: { id: string }) =>
  Effect.promise(() => client.tunings({ id: input.id }).delete()).pipe(
    Effect.flatMap((response) => {
      if (response && response.error) {
        return Effect.fail(
          new ApiError({
            message:
              (response.error.value as any)?.error ??
              "API error deleting tuning",
            cause: response.error,
          }),
        );
      }
      return Effect.succeed(undefined as void);
    }),
  );
