#pragma once
#define F(value) value
struct SerialStub {
  template <class... Args> void printf(const char*, Args...) {}
  void println(const char*) {}
};
extern SerialStub Serial;
