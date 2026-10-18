#pragma once
#include <stddef.h>
#include "FreeRTOS.h"
struct QueueStub;
using QueueHandle_t = QueueStub*;
QueueHandle_t xQueueCreate(size_t count, size_t size);
void vQueueDelete(QueueHandle_t queue);
int xQueueReceive(QueueHandle_t queue, void* out, TickType_t timeout);
int xQueueOverwrite(QueueHandle_t queue, const void* in);
