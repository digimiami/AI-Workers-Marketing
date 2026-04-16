export type Ok<T> = { ok: true; value: T };
export type Err<E extends { message: string } = { message: string }> = {
  ok: false;
  error: E;
};

export type Result<T, E extends { message: string } = { message: string }> =
  | Ok<T>
  | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E extends { message: string }>(error: E): Err<E> {
  return { ok: false, error };
}

