
import * as mqttRegex from "mqtt-regex";

export const MQTT_TOPIC_REGISTER = mqttRegex("dr/register/+nodeId");
export const MQTT_TOPIC_UNREGISTER = mqttRegex("dr/unregister/+nodeId");
export const MQTT_TOPIC_VALUE_UPDATE = mqttRegex("dr/device/+nodeId/+deviceId");
export const MQTT_TOPIC_VALUE_SET = mqttRegex("dr/device/+nodeId/+deviceId/set");
export const MQTT_TOPIC_REGISTER_REFRESH = mqttRegex("dr/register/update"); // this is only used for updating the registration, so that when we start, we get all devices that are conncted to the mqtt server
